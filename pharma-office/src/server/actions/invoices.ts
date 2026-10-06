"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { batches, drugstores, salesInvoiceItems, salesInvoices, skus, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser, hasPermission } from "@/lib/auth/current-user";
import { addDays, parseISODate, todayISO } from "@/lib/domain/dates";
import { computeLine, sumLines } from "@/lib/domain/pricing";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { drugstoreScopeSql } from "../scope";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    try {
      parseISODate(v);
      return true;
    } catch {
      return false;
    }
  });

const lineSchema = z.object({
  skuId: z.coerce.number().int().positive(),
  batchId: z.coerce.number().int().positive().nullable(),
  quantity: z.coerce.number().int().positive().max(1_000_000),
  bonusQuantity: z.coerce.number().int().min(0).max(1_000_000),
  unitPrice: z.coerce.number().int().min(0).max(100_000_000),
  discountPct: z.coerce.number().min(0).max(100),
});

const invoiceSchema = z.object({
  invoiceNumber: z
    .string()
    .trim()
    .max(48)
    .regex(/^[A-Za-z0-9\-/_.]*$/)
    .optional()
    .transform((v) => (v ? v : undefined)),
  drugstoreId: z.coerce.number().int().positive(),
  repId: z.string().uuid().nullable().optional(),
  invoiceDate: isoDate,
  paymentTermDays: z.coerce.number().int().min(0).max(365),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(lineSchema).min(1).max(50),
});

export type InvoiceFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createInvoiceAction(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : DEFAULT_LOCALE;
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/login`);
  if (!hasPermission(user, "invoices.create")) return { error: "forbidden" };

  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "generic" };
  }
  const parsed = invoiceSchema.safeParse({
    invoiceNumber: formData.get("invoiceNumber") ?? undefined,
    drugstoreId: formData.get("drugstoreId"),
    repId: formData.get("repId") || null,
    invoiceDate: formData.get("invoiceDate"),
    paymentTermDays: formData.get("paymentTermDays"),
    notes: formData.get("notes") || undefined,
    lines: linesRaw,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    if (parsed.error.issues.some((i) => i.path[0] === "lines" && i.path.length === 1)) return { error: "noLines", fieldErrors };
    return { error: "generic", fieldErrors };
  }
  const input = parsed.data;
  if (input.invoiceDate > todayISO()) return { error: "generic", fieldErrors: { invoiceDate: "future" } };

  const db = getDb();
  const [store] = await db
    .select({ id: drugstores.id })
    .from(drugstores)
    .where(and(eq(drugstores.id, input.drugstoreId), drugstoreScopeSql(user), eq(drugstores.active, true)))
    .limit(1);
  if (!store) return { error: "drugstoreScope" };

  if (input.repId) {
    const [rep] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.repId), eq(users.role, "sales_rep")));
    if (!rep) return { error: "generic", fieldErrors: { repId: "invalid" } };
  }

  const skuIds = [...new Set(input.lines.map((l) => l.skuId))];
  const skuRows = await db.select({ id: skus.id, listPrice: skus.listPrice }).from(skus).where(inArray(skus.id, skuIds));
  const skuById = new Map(skuRows.map((s) => [s.id, s]));
  const batchIds = input.lines.map((l) => l.batchId).filter((b): b is number => b !== null);
  const batchRows = batchIds.length
    ? await db.select({ id: batches.id, skuId: batches.skuId, expiryDate: batches.expiryDate }).from(batches).where(inArray(batches.id, batchIds))
    : [];
  const batchById = new Map(batchRows.map((b) => [b.id, b]));

  const computed: { line: (typeof input.lines)[number]; listPrice: number; totals: ReturnType<typeof computeLine> }[] = [];
  for (const [i, line] of input.lines.entries()) {
    const sku = skuById.get(line.skuId);
    if (!sku) return { error: "generic", fieldErrors: { [`lines.${i}.skuId`]: "invalid" } };
    if (line.batchId !== null) {
      const batch = batchById.get(line.batchId);
      if (!batch || batch.skuId !== line.skuId) return { error: `batchMismatch:${i + 1}` };
      if (batch.expiryDate <= input.invoiceDate) return { error: `batchExpired:${i + 1}` };
    }
    const totals = computeLine({
      quantity: line.quantity,
      bonusQuantity: line.bonusQuantity,
      unitPrice: line.unitPrice,
      listPrice: sku.listPrice,
      discountPct: line.discountPct,
    });
    computed.push({ line, listPrice: sku.listPrice, totals });
  }
  const sums = sumLines(computed.map((c) => c.totals));

  const invoiceId = await db.transaction(async (tx) => {
    // Serialise auto-numbering so two users never get the same number.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('sales_invoices.number'))`);
    let number = input.invoiceNumber;
    if (number) {
      const [dup] = await tx
        .select({ id: salesInvoices.id })
        .from(salesInvoices)
        .where(eq(salesInvoices.invoiceNumber, number))
        .limit(1);
      if (dup) return null;
    } else {
      const year = input.invoiceDate.slice(0, 4);
      const prefix = `INV-${year}-`;
      const [row] = await tx
        .select({ max: sql<string | null>`max(${salesInvoices.invoiceNumber})` })
        .from(salesInvoices)
        .where(like(salesInvoices.invoiceNumber, `${prefix}%`));
      const last = row?.max ? Number.parseInt(row.max.slice(prefix.length), 10) : 0;
      number = `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(5, "0")}`;
    }
    const [inv] = await tx
      .insert(salesInvoices)
      .values({
        invoiceNumber: number,
        invoiceDate: input.invoiceDate,
        drugstoreId: input.drugstoreId,
        repId: input.repId ?? null,
        paymentTermDays: input.paymentTermDays,
        dueDate: addDays(input.invoiceDate, input.paymentTermDays),
        grossAmount: sums.grossAmount,
        discountAmount: sums.discountAmount,
        netAmount: sums.netAmount,
        paidAmount: 0,
        notes: input.notes ?? null,
        createdBy: user.id,
      })
      .returning({ id: salesInvoices.id });
    await tx.insert(salesInvoiceItems).values(
      computed.map((c) => ({
        invoiceId: inv.id,
        skuId: c.line.skuId,
        batchId: c.line.batchId,
        quantity: c.line.quantity,
        bonusQuantity: c.line.bonusQuantity,
        listPrice: c.listPrice,
        unitPrice: c.line.unitPrice,
        discountPct: c.line.discountPct,
        grossAmount: c.totals.grossAmount,
        discountAmount: c.totals.discountAmount,
        netAmount: c.totals.netAmount,
      })),
    );
    await writeAudit(
      {
        userId: user.id,
        action: "invoice.create",
        entityType: "sales_invoice",
        entityId: inv.id,
        details: { invoiceNumber: number, netAmount: sums.netAmount, lines: computed.length },
      },
      tx,
    );
    return inv.id;
  });
  if (invoiceId === null) return { error: "duplicateNumber" };
  redirect(`/${lang}/sales/${invoiceId}`);
}
