"use server";

import { redirect } from "next/navigation";
import { and, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { drugstores, paymentAllocations, payments, salesInvoices } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser, hasPermission } from "@/lib/auth/current-user";
import { allocateFifo } from "@/lib/domain/allocation";
import { parseISODate, todayISO } from "@/lib/domain/dates";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { drugstoreScopeSql } from "../scope";

const paymentSchema = z.object({
  drugstoreId: z.coerce.number().int().positive(),
  amount: z.coerce.number().int().positive().max(100_000_000_000),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => {
      try {
        parseISODate(v);
        return true;
      } catch {
        return false;
      }
    }),
  method: z.enum(["cash", "bank_transfer", "cheque", "other"]),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type PaymentFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function recordPaymentAction(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : DEFAULT_LOCALE;
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/login`);
  if (!hasPermission(user, "payments.record")) return { error: "forbidden" };

  const parsed = paymentSchema.safeParse({
    drugstoreId: formData.get("drugstoreId"),
    amount: String(formData.get("amount") ?? "").replace(/[,\s]/g, ""),
    paymentDate: formData.get("paymentDate"),
    method: formData.get("method"),
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    return { error: "generic", fieldErrors };
  }
  const input = parsed.data;
  if (input.paymentDate > todayISO()) return { error: "futureDate", fieldErrors: { paymentDate: "future" } };

  const db = getDb();
  const [store] = await db
    .select({ id: drugstores.id })
    .from(drugstores)
    .where(and(eq(drugstores.id, input.drugstoreId), drugstoreScopeSql(user)))
    .limit(1);
  if (!store) return { error: "drugstoreScope" };

  const paymentId = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('payments.number'))`);
    // Lock the drugstore's open invoices so concurrent payments cannot over-allocate.
    const open = await tx
      .select({
        id: salesInvoices.id,
        dueDate: salesInvoices.dueDate,
        invoiceDate: salesInvoices.invoiceDate,
        netAmount: salesInvoices.netAmount,
        paidAmount: salesInvoices.paidAmount,
        isDisputed: salesInvoices.isDisputed,
      })
      .from(salesInvoices)
      .where(and(eq(salesInvoices.drugstoreId, input.drugstoreId), sql`${salesInvoices.paidAmount} < ${salesInvoices.netAmount}`))
      .for("update");
    const { allocations, unallocated } = allocateFifo(input.amount, open);

    const prefix = `RCPT-${input.paymentDate.slice(0, 4)}-`;
    const [row] = await tx
      .select({ max: sql<string | null>`max(${payments.paymentNumber})` })
      .from(payments)
      .where(like(payments.paymentNumber, `${prefix}%`));
    const last = row?.max ? Number.parseInt(row.max.slice(prefix.length), 10) : 0;
    const number = `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(5, "0")}`;

    const [pay] = await tx
      .insert(payments)
      .values({
        paymentNumber: number,
        drugstoreId: input.drugstoreId,
        paymentDate: input.paymentDate,
        amount: input.amount,
        method: input.method,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        receivedBy: user.id,
        createdBy: user.id,
      })
      .returning({ id: payments.id });
    if (allocations.length) {
      await tx.insert(paymentAllocations).values(allocations.map((a) => ({ paymentId: pay.id, invoiceId: a.invoiceId, amount: a.amount })));
      for (const a of allocations) {
        await tx
          .update(salesInvoices)
          .set({ paidAmount: sql`${salesInvoices.paidAmount} + ${a.amount}` })
          .where(eq(salesInvoices.id, a.invoiceId));
      }
    }
    await writeAudit(
      {
        userId: user.id,
        action: "payment.record",
        entityType: "payment",
        entityId: pay.id,
        details: { paymentNumber: number, amount: input.amount, allocations, unallocated },
      },
      tx,
    );
    return pay.id;
  });
  redirect(`/${lang}/collections?recorded=${paymentId}`);
}
