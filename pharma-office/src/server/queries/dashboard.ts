import "server-only";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { creditLimits, drugstores, marketSignals, payments, salesInvoices, salesTargets, users } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/current-user";
import { drugstoreScopeFor } from "@/lib/auth/permissions";
import { addDays, daysBetween } from "@/lib/domain/dates";
import {
  ATTENTION_RULES,
  compareByPriority,
  creditSeverity,
  disputedSeverity,
  dueSoonSeverity,
  overdueSeverity,
  type Severity,
} from "@/lib/domain/attention";
import { drugstoreScopeSql, targetTerritoryFor } from "../scope";

const outstanding = sql`(${salesInvoices.netAmount} - ${salesInvoices.paidAmount})`;
const num = (expr: ReturnType<typeof sql>) => sql<number>`coalesce(${expr}, 0)`.mapWith(Number);

export async function salesTotal(user: CurrentUser, from: string, to: string): Promise<number> {
  const [row] = await getDb()
    .select({ v: num(sql`sum(${salesInvoices.netAmount})`) })
    .from(salesInvoices)
    .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
    .where(and(drugstoreScopeSql(user), gte(salesInvoices.invoiceDate, from), lte(salesInvoices.invoiceDate, to)));
  return row?.v ?? 0;
}

export async function hasInvoicesOnOrBefore(user: CurrentUser, date: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(salesInvoices)
    .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
    .where(and(drugstoreScopeSql(user), lte(salesInvoices.invoiceDate, date)));
  return (row?.n ?? 0) > 0;
}

export async function collectionsTotal(user: CurrentUser, from: string, to: string): Promise<number> {
  const [row] = await getDb()
    .select({ v: num(sql`sum(${payments.amount})`) })
    .from(payments)
    .innerJoin(drugstores, eq(drugstores.id, payments.drugstoreId))
    .where(and(drugstoreScopeSql(user), gte(payments.paymentDate, from), lte(payments.paymentDate, to)));
  return row?.v ?? 0;
}

/** Net value of invoices whose due date falls in [from, to] (excluding disputed). */
export async function amountFallingDue(user: CurrentUser, from: string, to: string): Promise<number> {
  const [row] = await getDb()
    .select({ v: num(sql`sum(${salesInvoices.netAmount})`) })
    .from(salesInvoices)
    .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
    .where(
      and(
        drugstoreScopeSql(user),
        gte(salesInvoices.dueDate, from),
        lte(salesInvoices.dueDate, to),
        eq(salesInvoices.isDisputed, false),
      ),
    );
  return row?.v ?? 0;
}

export type ReceivablesSummary = {
  total: number;
  notDue: number;
  overdue: number;
  disputed: number;
  overdueDrugstores: number;
};

export async function receivablesSummary(user: CurrentUser, today: string): Promise<ReceivablesSummary> {
  const [row] = await getDb()
    .select({
      total: num(sql`sum(${outstanding})`),
      notDue: num(sql`sum(${outstanding}) filter (where ${salesInvoices.dueDate} >= ${today} and not ${salesInvoices.isDisputed})`),
      overdue: num(sql`sum(${outstanding}) filter (where ${salesInvoices.dueDate} < ${today} and not ${salesInvoices.isDisputed})`),
      disputed: num(sql`sum(${outstanding}) filter (where ${salesInvoices.isDisputed})`),
      overdueDrugstores: num(
        sql`count(distinct ${salesInvoices.drugstoreId}) filter (where ${salesInvoices.dueDate} < ${today} and not ${salesInvoices.isDisputed} and ${outstanding} > 0)`,
      ),
    })
    .from(salesInvoices)
    .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
    .where(and(drugstoreScopeSql(user), sql`${outstanding} > 0`));
  return row ?? { total: 0, notDue: 0, overdue: 0, disputed: 0, overdueDrugstores: 0 };
}

/** Monthly target for the user's scope; null when no target applies or none is set. */
export async function monthlyTarget(user: CurrentUser, month: string): Promise<number | null> {
  const territory = targetTerritoryFor(user);
  if (territory === undefined) return null;
  const [row] = await getDb()
    .select({ v: sql<number | null>`sum(${salesTargets.targetAmount})`.mapWith((v) => (v === null ? null : Number(v))) })
    .from(salesTargets)
    .where(and(eq(salesTargets.month, month), territory === null ? sql`true` : eq(salesTargets.territoryId, territory)));
  return row?.v ?? null;
}

export async function openSignalsCount(user: CurrentUser, since: string): Promise<number> {
  const scope = drugstoreScopeFor(user);
  const scopeCond =
    scope.kind === "all"
      ? sql`true`
      : scope.kind === "territory"
        ? sql`coalesce(${drugstores.territoryId}, ${marketSignals.territoryId}) = ${scope.territoryId}`
        : scope.kind === "assigned"
          ? sql`(${drugstores.assignedRepId} = ${scope.userId} or ${marketSignals.reporterId} = ${scope.userId})`
          : sql`false`;
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(marketSignals)
    .leftJoin(drugstores, eq(drugstores.id, marketSignals.drugstoreId))
    .where(and(scopeCond, eq(marketSignals.status, "open"), gte(marketSignals.signalDate, since)));
  return row?.n ?? 0;
}

export async function monthlySales(user: CurrentUser, fromMonth: string, to: string) {
  const month = sql<string>`to_char(date_trunc('month', ${salesInvoices.invoiceDate}), 'YYYY-MM-01')`;
  return getDb()
    .select({ month, value: num(sql`sum(${salesInvoices.netAmount})`) })
    .from(salesInvoices)
    .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
    .where(and(drugstoreScopeSql(user), gte(salesInvoices.invoiceDate, fromMonth), lte(salesInvoices.invoiceDate, to)))
    .groupBy(month)
    .orderBy(month);
}

// ─── Attention required ──────────────────────────────────────────────────────

export type AttentionKind = "overdue" | "due_soon" | "credit" | "disputed";

export type AttentionItem = {
  key: string;
  kind: AttentionKind;
  severity: Severity;
  amount: number;
  drugstoreId: number;
  drugstoreName: string;
  drugstoreNameAr: string;
  responsible: string | null;
  responsibleAr: string | null;
  /** Kind-specific facts used to render evidence lines. */
  facts: {
    invoiceCount?: number;
    maxDaysOverdue?: number;
    nextDueDate?: string;
    exposure?: number;
    limit?: number;
    utilisation?: number;
    termDays?: number;
  };
};

export async function attentionItems(user: CurrentUser, today: string): Promise<AttentionItem[]> {
  const db = getDb();
  const soonTo = addDays(today, ATTENTION_RULES.dueSoonWindowDays);
  const rows = await db
    .select({
      drugstoreId: drugstores.id,
      name: drugstores.name,
      nameAr: drugstores.nameAr,
      term: drugstores.paymentTermDays,
      repName: users.fullName,
      repNameAr: users.fullNameAr,
      exposure: num(sql`sum(${outstanding})`),
      overdueAmount: num(sql`sum(${outstanding}) filter (where ${salesInvoices.dueDate} < ${today} and not ${salesInvoices.isDisputed})`),
      overdueCount: num(sql`count(*) filter (where ${salesInvoices.dueDate} < ${today} and not ${salesInvoices.isDisputed})`),
      oldestDue: sql<string | null>`min(${salesInvoices.dueDate}) filter (where ${salesInvoices.dueDate} < ${today} and not ${salesInvoices.isDisputed})`,
      soonAmount: num(
        sql`sum(${outstanding}) filter (where ${salesInvoices.dueDate} between ${today} and ${soonTo} and not ${salesInvoices.isDisputed})`,
      ),
      soonCount: num(sql`count(*) filter (where ${salesInvoices.dueDate} between ${today} and ${soonTo} and not ${salesInvoices.isDisputed})`),
      nextDue: sql<string | null>`min(${salesInvoices.dueDate}) filter (where ${salesInvoices.dueDate} between ${today} and ${soonTo} and not ${salesInvoices.isDisputed})`,
      disputedAmount: num(sql`sum(${outstanding}) filter (where ${salesInvoices.isDisputed})`),
      disputedCount: num(sql`count(*) filter (where ${salesInvoices.isDisputed})`),
      limit: sql<number | null>`(select ${creditLimits.limitAmount} from ${creditLimits} where ${creditLimits.drugstoreId} = ${drugstores.id} and ${creditLimits.effectiveTo} is null order by ${creditLimits.effectiveFrom} desc limit 1)`.mapWith(
        (v) => (v === null ? null : Number(v)),
      ),
    })
    .from(salesInvoices)
    .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
    .leftJoin(users, eq(users.id, drugstores.assignedRepId))
    .where(and(drugstoreScopeSql(user), sql`${outstanding} > 0`))
    .groupBy(drugstores.id, users.fullName, users.fullNameAr);

  const items: AttentionItem[] = [];
  for (const r of rows) {
    const base = {
      drugstoreId: r.drugstoreId,
      drugstoreName: r.name,
      drugstoreNameAr: r.nameAr,
      responsible: r.repName,
      responsibleAr: r.repNameAr,
    };
    if (r.overdueAmount > 0 && r.oldestDue) {
      const maxDays = daysBetween(r.oldestDue, today);
      items.push({
        ...base, key: `overdue-${r.drugstoreId}`, kind: "overdue", amount: r.overdueAmount,
        severity: overdueSeverity(r.overdueAmount, maxDays),
        facts: { invoiceCount: r.overdueCount, maxDaysOverdue: maxDays, termDays: r.term },
      });
    }
    if (r.soonAmount > 0 && r.nextDue) {
      items.push({
        ...base, key: `due-${r.drugstoreId}`, kind: "due_soon", amount: r.soonAmount,
        severity: dueSoonSeverity(r.soonAmount),
        facts: { invoiceCount: r.soonCount, nextDueDate: r.nextDue },
      });
    }
    if (r.limit && r.limit > 0) {
      const utilisation = r.exposure / r.limit;
      const sev = creditSeverity(utilisation);
      if (sev) {
        items.push({
          ...base, key: `credit-${r.drugstoreId}`, kind: "credit", amount: r.exposure, severity: sev,
          facts: { exposure: r.exposure, limit: r.limit, utilisation },
        });
      }
    }
    if (r.disputedAmount > 0) {
      items.push({
        ...base, key: `disputed-${r.drugstoreId}`, kind: "disputed", amount: r.disputedAmount,
        severity: disputedSeverity(r.disputedAmount), facts: { invoiceCount: r.disputedCount },
      });
    }
  }
  return items.sort(compareByPriority);
}

export async function drugstoresByExposure(user: CurrentUser, today: string, limit = 8) {
  const exposure = num(sql`sum(${outstanding})`);
  return getDb()
    .select({
      id: drugstores.id,
      name: drugstores.name,
      nameAr: drugstores.nameAr,
      exposure,
      overdue: num(sql`sum(${outstanding}) filter (where ${salesInvoices.dueDate} < ${today} and not ${salesInvoices.isDisputed})`),
      sales90: num(sql`sum(${salesInvoices.netAmount}) filter (where ${salesInvoices.invoiceDate} >= ${addDays(today, -90)})`),
      limit: sql<number | null>`(select ${creditLimits.limitAmount} from ${creditLimits} where ${creditLimits.drugstoreId} = ${drugstores.id} and ${creditLimits.effectiveTo} is null order by ${creditLimits.effectiveFrom} desc limit 1)`.mapWith(
        (v) => (v === null ? null : Number(v)),
      ),
    })
    .from(drugstores)
    .innerJoin(salesInvoices, eq(salesInvoices.drugstoreId, drugstores.id))
    .where(drugstoreScopeSql(user))
    .groupBy(drugstores.id)
    .orderBy(sql`sum(${outstanding}) desc`)
    .limit(limit);
}
