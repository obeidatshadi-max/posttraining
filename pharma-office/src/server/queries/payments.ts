import "server-only";
import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { drugstores, paymentAllocations, payments, salesInvoices } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/current-user";
import { drugstoreScopeSql } from "../scope";

export const PAYMENTS_PAGE_SIZE = 25;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const paymentFiltersSchema = z.object({
  drugstore: z.coerce.number().int().positive().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  method: z.enum(["cash", "bank_transfer", "cheque", "other"]).optional().catch(undefined),
  recorded: z.coerce.number().int().positive().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;

export async function listPayments(user: CurrentUser, f: PaymentFilters) {
  const conds: SQL[] = [drugstoreScopeSql(user)];
  if (f.drugstore) conds.push(eq(payments.drugstoreId, f.drugstore));
  if (f.from) conds.push(gte(payments.paymentDate, f.from));
  if (f.to) conds.push(lte(payments.paymentDate, f.to));
  if (f.method) conds.push(eq(payments.method, f.method));
  const where = and(...conds);
  const allocated = sql<number>`coalesce((select sum(${paymentAllocations.amount}) from ${paymentAllocations} where ${paymentAllocations.paymentId} = ${payments.id}), 0)`.mapWith(Number);
  const db = getDb();
  const [rows, [agg]] = await Promise.all([
    db
      .select({
        id: payments.id,
        paymentNumber: payments.paymentNumber,
        paymentDate: payments.paymentDate,
        amount: payments.amount,
        method: payments.method,
        reference: payments.reference,
        drugstoreId: drugstores.id,
        drugstoreName: drugstores.name,
        drugstoreNameAr: drugstores.nameAr,
        allocated,
      })
      .from(payments)
      .innerJoin(drugstores, eq(drugstores.id, payments.drugstoreId))
      .where(where)
      .orderBy(desc(payments.paymentDate), desc(payments.id))
      .limit(PAYMENTS_PAGE_SIZE)
      .offset((f.page - 1) * PAYMENTS_PAGE_SIZE),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        amount: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number),
      })
      .from(payments)
      .innerJoin(drugstores, eq(drugstores.id, payments.drugstoreId))
      .where(where),
  ]);
  return { rows, total: agg?.count ?? 0, amount: agg?.amount ?? 0 };
}

export async function getRecordedPayment(user: CurrentUser, id: number) {
  const [row] = await getDb()
    .select({ paymentNumber: payments.paymentNumber, amount: payments.amount, drugstoreName: drugstores.name, drugstoreNameAr: drugstores.nameAr })
    .from(payments)
    .innerJoin(drugstores, eq(drugstores.id, payments.drugstoreId))
    .where(and(eq(payments.id, id), drugstoreScopeSql(user)))
    .limit(1);
  return row ?? null;
}

/** Drugstores in scope plus their open invoices, for the allocation preview. */
export async function paymentFormOptions(user: CurrentUser) {
  const db = getDb();
  const [stores, open] = await Promise.all([
    db
      .select({ id: drugstores.id, name: drugstores.name, nameAr: drugstores.nameAr })
      .from(drugstores)
      .where(drugstoreScopeSql(user))
      .orderBy(asc(drugstores.name)),
    db
      .select({
        id: salesInvoices.id,
        drugstoreId: salesInvoices.drugstoreId,
        invoiceNumber: salesInvoices.invoiceNumber,
        invoiceDate: salesInvoices.invoiceDate,
        dueDate: salesInvoices.dueDate,
        netAmount: salesInvoices.netAmount,
        paidAmount: salesInvoices.paidAmount,
        isDisputed: salesInvoices.isDisputed,
      })
      .from(salesInvoices)
      .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
      .where(and(drugstoreScopeSql(user), sql`${salesInvoices.paidAmount} < ${salesInvoices.netAmount}`))
      .orderBy(asc(salesInvoices.dueDate)),
  ]);
  return { drugstores: stores, openInvoices: open };
}
