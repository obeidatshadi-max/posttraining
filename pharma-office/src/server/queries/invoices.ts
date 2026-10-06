import "server-only";
import { and, asc, desc, eq, exists, gte, ilike, lte, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  batches,
  drugstores,
  paymentAllocations,
  payments,
  products,
  salesInvoiceItems,
  salesInvoices,
  skus,
  territories,
  users,
} from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/current-user";
import { addDays } from "@/lib/domain/dates";
import { DUE_SOON_DAYS, PAYMENT_STATUSES, type PaymentStatus } from "@/lib/domain/payment-status";
import { drugstoreScopeSql } from "../scope";

export const PAGE_SIZE = 25;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalInt = z.coerce.number().int().positive().optional().catch(undefined);

/** Parses untrusted URL search params into a safe filter object. */
export const invoiceFiltersSchema = z.object({
  q: z.string().trim().max(64).optional().catch(undefined),
  territory: optionalInt,
  drugstore: optionalInt,
  product: optionalInt,
  rep: z.string().uuid().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  status: z.enum(PAYMENT_STATUSES).optional().catch(undefined),
  expiryBefore: isoDate.optional().catch(undefined),
  min: z.coerce.number().nonnegative().optional().catch(undefined),
  max: z.coerce.number().nonnegative().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;

const outstanding = sql`(${salesInvoices.netAmount} - ${salesInvoices.paidAmount})`;

/**
 * SQL mirror of `paymentStatus()` in lib/domain/payment-status.ts. The
 * precedence must stay identical; an integration test checks they agree.
 */
export function statusCondition(status: PaymentStatus, today: string): SQL {
  const open = sql`${outstanding} > 0`;
  const notDisputed = sql`not ${salesInvoices.isDisputed}`;
  const soonEnd = addDays(today, DUE_SOON_DAYS);
  switch (status) {
    case "paid":
      return sql`${outstanding} <= 0`;
    case "disputed":
      return sql`${open} and ${salesInvoices.isDisputed}`;
    case "overdue":
      return sql`${open} and ${notDisputed} and ${salesInvoices.dueDate} < ${today}`;
    case "due":
      return sql`${open} and ${notDisputed} and ${salesInvoices.dueDate} = ${today}`;
    case "due_soon":
      return sql`${open} and ${notDisputed} and ${salesInvoices.dueDate} > ${today} and ${salesInvoices.dueDate} <= ${soonEnd}`;
    case "partially_paid":
      return sql`${open} and ${notDisputed} and ${salesInvoices.dueDate} > ${soonEnd} and ${salesInvoices.paidAmount} > 0`;
    case "not_due":
      return sql`${open} and ${notDisputed} and ${salesInvoices.dueDate} > ${soonEnd} and ${salesInvoices.paidAmount} = 0`;
  }
}

function filterConditions(user: CurrentUser, f: InvoiceFilters, today: string): SQL[] {
  const conds: SQL[] = [drugstoreScopeSql(user)];
  if (f.q) conds.push(ilike(salesInvoices.invoiceNumber, `%${f.q.replace(/[%_\\]/g, "\\$&")}%`));
  if (f.territory) conds.push(eq(drugstores.territoryId, f.territory));
  if (f.drugstore) conds.push(eq(salesInvoices.drugstoreId, f.drugstore));
  if (f.rep) conds.push(eq(salesInvoices.repId, f.rep));
  if (f.from) conds.push(gte(salesInvoices.invoiceDate, f.from));
  if (f.to) conds.push(lte(salesInvoices.invoiceDate, f.to));
  if (f.min !== undefined) conds.push(gte(salesInvoices.netAmount, f.min));
  if (f.max !== undefined) conds.push(lte(salesInvoices.netAmount, f.max));
  if (f.status) conds.push(statusCondition(f.status, today));
  if (f.product || f.expiryBefore) {
    const db = getDb();
    const itemConds: SQL[] = [eq(salesInvoiceItems.invoiceId, salesInvoices.id)];
    if (f.product) itemConds.push(eq(skus.productId, f.product));
    if (f.expiryBefore) itemConds.push(lte(batches.expiryDate, f.expiryBefore));
    conds.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(salesInvoiceItems)
          .innerJoin(skus, eq(skus.id, salesInvoiceItems.skuId))
          .leftJoin(batches, eq(batches.id, salesInvoiceItems.batchId))
          .where(and(...itemConds)),
      ),
    );
  }
  return conds;
}

export async function listInvoices(user: CurrentUser, f: InvoiceFilters, today: string) {
  const db = getDb();
  const where = and(...filterConditions(user, f, today));
  const [rows, [agg]] = await Promise.all([
    db
      .select({
        id: salesInvoices.id,
        invoiceNumber: salesInvoices.invoiceNumber,
        invoiceDate: salesInvoices.invoiceDate,
        dueDate: salesInvoices.dueDate,
        netAmount: salesInvoices.netAmount,
        paidAmount: salesInvoices.paidAmount,
        isDisputed: salesInvoices.isDisputed,
        drugstoreId: drugstores.id,
        drugstoreName: drugstores.name,
        drugstoreNameAr: drugstores.nameAr,
        territoryEn: territories.nameEn,
        territoryAr: territories.nameAr,
        repName: users.fullName,
        repNameAr: users.fullNameAr,
      })
      .from(salesInvoices)
      .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
      .innerJoin(territories, eq(territories.id, drugstores.territoryId))
      .leftJoin(users, eq(users.id, salesInvoices.repId))
      .where(where)
      .orderBy(desc(salesInvoices.invoiceDate), desc(salesInvoices.id))
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        net: sql<number>`coalesce(sum(${salesInvoices.netAmount}), 0)`.mapWith(Number),
        paid: sql<number>`coalesce(sum(${salesInvoices.paidAmount}), 0)`.mapWith(Number),
      })
      .from(salesInvoices)
      .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
      .where(where),
  ]);
  return { rows, total: agg?.count ?? 0, totals: { net: agg?.net ?? 0, paid: agg?.paid ?? 0 } };
}

export async function invoiceFilterOptions(user: CurrentUser) {
  const db = getDb();
  const [stores, terrs, prods, reps] = await Promise.all([
    db
      .select({ id: drugstores.id, name: drugstores.name, nameAr: drugstores.nameAr, territoryId: drugstores.territoryId })
      .from(drugstores)
      .where(drugstoreScopeSql(user))
      .orderBy(asc(drugstores.name)),
    db.select({ id: territories.id, nameEn: territories.nameEn, nameAr: territories.nameAr }).from(territories).orderBy(asc(territories.id)),
    db.select({ id: products.id, name: products.name, nameAr: products.nameAr }).from(products).orderBy(asc(products.name)),
    db
      .select({ id: users.id, fullName: users.fullName, fullNameAr: users.fullNameAr })
      .from(users)
      .where(eq(users.role, "sales_rep"))
      .orderBy(asc(users.fullName)),
  ]);
  const visibleTerritories = new Set(stores.map((s) => s.territoryId));
  return { drugstores: stores, territories: terrs.filter((t) => visibleTerritories.has(t.id)), products: prods, reps };
}

export async function getInvoice(user: CurrentUser, id: number) {
  const db = getDb();
  const creator = alias(users, "creator");
  const [inv] = await db
    .select({
      id: salesInvoices.id,
      invoiceNumber: salesInvoices.invoiceNumber,
      invoiceDate: salesInvoices.invoiceDate,
      dueDate: salesInvoices.dueDate,
      paymentTermDays: salesInvoices.paymentTermDays,
      grossAmount: salesInvoices.grossAmount,
      discountAmount: salesInvoices.discountAmount,
      netAmount: salesInvoices.netAmount,
      paidAmount: salesInvoices.paidAmount,
      isDisputed: salesInvoices.isDisputed,
      disputeNote: salesInvoices.disputeNote,
      notes: salesInvoices.notes,
      drugstoreId: drugstores.id,
      drugstoreName: drugstores.name,
      drugstoreNameAr: drugstores.nameAr,
      repName: users.fullName,
      repNameAr: users.fullNameAr,
      createdByName: creator.fullName,
      createdByNameAr: creator.fullNameAr,
    })
    .from(salesInvoices)
    .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
    .leftJoin(users, eq(users.id, salesInvoices.repId))
    .leftJoin(creator, eq(creator.id, salesInvoices.createdBy))
    .where(and(eq(salesInvoices.id, id), drugstoreScopeSql(user)))
    .limit(1);
  if (!inv) return null;
  const [lines, allocs] = await Promise.all([
    db
      .select({
        id: salesInvoiceItems.id,
        productName: products.name,
        productNameAr: products.nameAr,
        skuCode: skus.code,
        packSize: skus.packSize,
        batchNumber: batches.batchNumber,
        expiryDate: batches.expiryDate,
        quantity: salesInvoiceItems.quantity,
        bonusQuantity: salesInvoiceItems.bonusQuantity,
        listPrice: salesInvoiceItems.listPrice,
        unitPrice: salesInvoiceItems.unitPrice,
        discountPct: salesInvoiceItems.discountPct,
        grossAmount: salesInvoiceItems.grossAmount,
        discountAmount: salesInvoiceItems.discountAmount,
        netAmount: salesInvoiceItems.netAmount,
      })
      .from(salesInvoiceItems)
      .innerJoin(skus, eq(skus.id, salesInvoiceItems.skuId))
      .innerJoin(products, eq(products.id, skus.productId))
      .leftJoin(batches, eq(batches.id, salesInvoiceItems.batchId))
      .where(eq(salesInvoiceItems.invoiceId, id))
      .orderBy(asc(salesInvoiceItems.id)),
    db
      .select({
        paymentId: payments.id,
        paymentNumber: payments.paymentNumber,
        paymentDate: payments.paymentDate,
        method: payments.method,
        amount: paymentAllocations.amount,
      })
      .from(paymentAllocations)
      .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
      .where(eq(paymentAllocations.invoiceId, id))
      .orderBy(asc(payments.paymentDate)),
  ]);
  return { ...inv, lines, allocations: allocs };
}

export async function invoiceFormOptions(user: CurrentUser, today: string) {
  const db = getDb();
  const [stores, skuRows, batchRows, reps] = await Promise.all([
    db
      .select({
        id: drugstores.id,
        name: drugstores.name,
        nameAr: drugstores.nameAr,
        paymentTermDays: drugstores.paymentTermDays,
        assignedRepId: drugstores.assignedRepId,
      })
      .from(drugstores)
      .where(and(drugstoreScopeSql(user), eq(drugstores.active, true)))
      .orderBy(asc(drugstores.name)),
    db
      .select({
        id: skus.id,
        code: skus.code,
        packSize: skus.packSize,
        listPrice: skus.listPrice,
        productName: products.name,
        productNameAr: products.nameAr,
      })
      .from(skus)
      .innerJoin(products, eq(products.id, skus.productId))
      .where(and(eq(skus.active, true), eq(products.active, true)))
      .orderBy(asc(products.name)),
    db
      .select({ id: batches.id, skuId: batches.skuId, batchNumber: batches.batchNumber, expiryDate: batches.expiryDate })
      .from(batches)
      .where(gte(batches.expiryDate, today))
      .orderBy(asc(batches.expiryDate)),
    db
      .select({ id: users.id, fullName: users.fullName, fullNameAr: users.fullNameAr })
      .from(users)
      .where(and(eq(users.role, "sales_rep"), eq(users.active, true)))
      .orderBy(asc(users.fullName)),
  ]);
  return { drugstores: stores, skus: skuRows, batches: batchRows, reps };
}
