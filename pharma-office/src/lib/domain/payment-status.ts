import { daysBetween } from "./dates";

/**
 * Invoice payment status, derived at read time from CONFIRMED data
 * (due date, net amount, paid amount, dispute flag). Never stored, so it can
 * never go stale.
 *
 * Precedence (first match wins):
 *   Paid → Disputed → Overdue → Due (due today) → Due Soon (≤ N days)
 *   → Partially Paid → Not Due
 *
 * "Overdue" only applies once the due date has passed. Outstanding amounts
 * that are not yet due are NOT overdue.
 */
export const PAYMENT_STATUSES = [
  "not_due",
  "due_soon",
  "due",
  "partially_paid",
  "overdue",
  "paid",
  "disputed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DUE_SOON_DAYS = 7;

export type InvoicePaymentFacts = {
  dueDate: string;
  netAmount: number;
  paidAmount: number;
  isDisputed: boolean;
};

export function outstandingOf(inv: Pick<InvoicePaymentFacts, "netAmount" | "paidAmount">): number {
  return Math.max(0, inv.netAmount - inv.paidAmount);
}

export function paymentStatus(inv: InvoicePaymentFacts, today: string, dueSoonDays = DUE_SOON_DAYS): PaymentStatus {
  const outstanding = outstandingOf(inv);
  if (outstanding <= 0) return "paid";
  if (inv.isDisputed) return "disputed";
  const daysToDue = daysBetween(today, inv.dueDate);
  if (daysToDue < 0) return "overdue";
  if (daysToDue === 0) return "due";
  if (daysToDue <= dueSoonDays) return "due_soon";
  if (inv.paidAmount > 0) return "partially_paid";
  return "not_due";
}

/** Days past due (0 when not overdue). */
export function daysOverdue(dueDate: string, today: string): number {
  return Math.max(0, daysBetween(dueDate, today));
}
