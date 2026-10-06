import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  creditLimits,
  drugstores,
  marketSignals,
  payments,
  products,
  returns,
  salesInvoiceItems,
  salesInvoices,
  skus,
  territories,
  users,
} from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/current-user";
import { addDays, daysBetween } from "@/lib/domain/dates";
import { drugstoreScopeSql } from "../scope";

export const drugstoreFiltersSchema = z.object({
  q: z.string().trim().max(64).optional().catch(undefined),
  territory: z.coerce.number().int().positive().optional().catch(undefined),
});
export type DrugstoreFilters = z.infer<typeof drugstoreFiltersSchema>;

const outstanding = sql`(${salesInvoices.netAmount} - ${salesInvoices.paidAmount})`;
const n = (expr: SQL) => sql<number>`coalesce(${expr}, 0)`.mapWith(Number);
const currentLimit = sql<number | null>`(select ${creditLimits.limitAmount} from ${creditLimits} where ${creditLimits.drugstoreId} = ${drugstores.id} and ${creditLimits.effectiveTo} is null order by ${creditLimits.effectiveFrom} desc limit 1)`.mapWith(
  (v) => (v === null ? null : Number(v)),
);

export async function listDrugstores(user: CurrentUser, f: DrugstoreFilters, today: string) {
  const conds: SQL[] = [drugstoreScopeSql(user)];
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(or(ilike(drugstores.name, like), ilike(drugstores.nameAr, like), ilike(drugstores.code, like))!);
  }
  if (f.territory) conds.push(eq(drugstores.territoryId, f.territory));
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return getDb()
    .select({
      id: drugstores.id,
      code: drugstores.code,
      name: drugstores.name,
      nameAr: drugstores.nameAr,
      city: drugstores.city,
      active: drugstores.active,
      territoryEn: territories.nameEn,
      territoryAr: territories.nameAr,
      repName: users.fullName,
      repNameAr: users.fullNameAr,
      salesYtd: n(sql`sum(${salesInvoices.netAmount}) filter (where ${salesInvoices.invoiceDate} >= ${yearStart})`),
      outstanding: n(sql`sum(${outstanding})`),
      overdue: n(sql`sum(${outstanding}) filter (where ${salesInvoices.dueDate} < ${today} and not ${salesInvoices.isDisputed})`),
      lastOrder: sql<string | null>`max(${salesInvoices.invoiceDate})`,
      limit: currentLimit,
    })
    .from(drugstores)
    .innerJoin(territories, eq(territories.id, drugstores.territoryId))
    .leftJoin(users, eq(users.id, drugstores.assignedRepId))
    .leftJoin(salesInvoices, eq(salesInvoices.drugstoreId, drugstores.id))
    .where(and(...conds))
    .groupBy(drugstores.id, territories.id, users.id)
    .orderBy(sql`sum(${outstanding}) desc nulls last`, asc(drugstores.name));
}

export async function getDrugstore(user: CurrentUser, id: number, today: string) {
  const db = getDb();
  const manager = alias(users, "manager");
  const [store] = await db
    .select({
      id: drugstores.id,
      code: drugstores.code,
      name: drugstores.name,
      nameAr: drugstores.nameAr,
      city: drugstores.city,
      address: drugstores.address,
      contactPerson: drugstores.contactPerson,
      phone: drugstores.phone,
      active: drugstores.active,
      paymentTermDays: drugstores.paymentTermDays,
      territoryEn: territories.nameEn,
      territoryAr: territories.nameAr,
      repName: users.fullName,
      repNameAr: users.fullNameAr,
      managerName: manager.fullName,
      managerNameAr: manager.fullNameAr,
      limit: currentLimit,
    })
    .from(drugstores)
    .innerJoin(territories, eq(territories.id, drugstores.territoryId))
    .leftJoin(users, eq(users.id, drugstores.assignedRepId))
    .leftJoin(manager, eq(manager.id, drugstores.assignedManagerId))
    .where(and(eq(drugstores.id, id), drugstoreScopeSql(user)))
    .limit(1);
  if (!store) return null;

  const yearStart = `${today.slice(0, 4)}-01-01`;
  const yearAgo = addDays(today, -365);
  const [[agg], [activeProducts], [ret], recentInvoices, recentPayments, signals] = await Promise.all([
    db
      .select({
        total: n(sql`sum(${salesInvoices.netAmount})`),
        ytd: n(sql`sum(${salesInvoices.netAmount}) filter (where ${salesInvoices.invoiceDate} >= ${yearStart})`),
        last12: n(sql`sum(${salesInvoices.netAmount}) filter (where ${salesInvoices.invoiceDate} >= ${yearAgo})`),
        count: n(sql`count(*)`),
        lastOrder: sql<string | null>`max(${salesInvoices.invoiceDate})`,
        outstanding: n(sql`sum(${outstanding})`),
        notDue: n(sql`sum(${outstanding}) filter (where ${salesInvoices.dueDate} >= ${today} and not ${salesInvoices.isDisputed})`),
        overdue: n(sql`sum(${outstanding}) filter (where ${salesInvoices.dueDate} < ${today} and not ${salesInvoices.isDisputed})`),
        disputed: n(sql`sum(${outstanding}) filter (where ${salesInvoices.isDisputed})`),
        oldestOverdueDue: sql<string | null>`min(${salesInvoices.dueDate}) filter (where ${salesInvoices.dueDate} < ${today} and not ${salesInvoices.isDisputed} and ${outstanding} > 0)`,
      })
      .from(salesInvoices)
      .where(eq(salesInvoices.drugstoreId, id)),
    db
      .select({ count: n(sql`count(distinct ${skus.productId})`) })
      .from(salesInvoiceItems)
      .innerJoin(salesInvoices, eq(salesInvoices.id, salesInvoiceItems.invoiceId))
      .innerJoin(skus, eq(skus.id, salesInvoiceItems.skuId))
      .where(and(eq(salesInvoices.drugstoreId, id), sql`${salesInvoices.invoiceDate} >= ${yearAgo}`)),
    db
      .select({
        count: n(sql`count(*)`),
        value: n(sql`sum(${returns.totalValue})`),
        expiryValue: n(sql`sum(${returns.totalValue}) filter (where ${returns.reason} in ('expiry', 'near_expiry'))`),
        damagedValue: n(sql`sum(${returns.totalValue}) filter (where ${returns.reason} = 'damaged')`),
      })
      .from(returns)
      .where(and(eq(returns.drugstoreId, id), sql`${returns.returnDate} >= ${yearAgo}`)),
    db
      .select({
        id: salesInvoices.id,
        invoiceNumber: salesInvoices.invoiceNumber,
        invoiceDate: salesInvoices.invoiceDate,
        dueDate: salesInvoices.dueDate,
        netAmount: salesInvoices.netAmount,
        paidAmount: salesInvoices.paidAmount,
        isDisputed: salesInvoices.isDisputed,
      })
      .from(salesInvoices)
      .where(eq(salesInvoices.drugstoreId, id))
      .orderBy(desc(salesInvoices.invoiceDate), desc(salesInvoices.id))
      .limit(10),
    db
      .select({
        id: payments.id,
        paymentNumber: payments.paymentNumber,
        paymentDate: payments.paymentDate,
        amount: payments.amount,
        method: payments.method,
      })
      .from(payments)
      .where(eq(payments.drugstoreId, id))
      .orderBy(desc(payments.paymentDate), desc(payments.id))
      .limit(10),
    db
      .select({
        id: marketSignals.id,
        signalDate: marketSignals.signalDate,
        category: marketSignals.category,
        observation: marketSignals.observation,
        confidence: marketSignals.confidence,
        sourceEntity: marketSignals.sourceEntity,
        status: marketSignals.status,
        productName: products.name,
        productNameAr: products.nameAr,
        reporterName: users.fullName,
        reporterNameAr: users.fullNameAr,
      })
      .from(marketSignals)
      .leftJoin(products, eq(products.id, marketSignals.productId))
      .leftJoin(users, eq(users.id, marketSignals.reporterId))
      .where(eq(marketSignals.drugstoreId, id))
      .orderBy(desc(marketSignals.signalDate))
      .limit(10),
  ]);

  const a = agg!;
  return {
    ...store,
    commercial: {
      totalPurchases: a.total,
      ytd: a.ytd,
      last12: a.last12,
      invoiceCount: a.count,
      lastOrder: a.lastOrder,
      avgOrder: a.count ? Math.round(a.total / a.count) : 0,
      activeProducts: activeProducts?.count ?? 0,
    },
    financial: {
      outstanding: a.outstanding,
      notDue: a.notDue,
      overdue: a.overdue,
      disputed: a.disputed,
      longestOverdueDays: a.oldestOverdueDue ? daysBetween(a.oldestOverdueDue, today) : 0,
      limit: store.limit,
      utilisation: store.limit ? a.outstanding / store.limit : null,
      available: store.limit !== null ? store.limit - a.outstanding : null,
    },
    returns12m: {
      count: ret?.count ?? 0,
      value: ret?.value ?? 0,
      expiryValue: ret?.expiryValue ?? 0,
      damagedValue: ret?.damagedValue ?? 0,
      rate: a.last12 ? (ret?.value ?? 0) / a.last12 : null,
    },
    recentInvoices,
    recentPayments,
    signals,
  };
}
