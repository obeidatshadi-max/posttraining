/**
 * Allocates a received payment across a drugstore's open invoices.
 *
 * Rule: oldest due date first (then oldest invoice date, then id). Disputed
 * invoices are skipped — they should be settled deliberately, not by
 * automatic allocation. Any remainder stays unallocated (on-account credit)
 * and is reported, never silently dropped.
 */
export type OpenInvoice = {
  id: number;
  dueDate: string;
  invoiceDate: string;
  netAmount: number;
  paidAmount: number;
  isDisputed: boolean;
};

export type AllocationResult = {
  allocations: { invoiceId: number; amount: number }[];
  unallocated: number;
};

export function allocateFifo(amount: number, invoices: OpenInvoice[]): AllocationResult {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be positive");
  const ordered = invoices
    .filter((i) => !i.isDisputed && i.netAmount - i.paidAmount > 0)
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) || a.invoiceDate.localeCompare(b.invoiceDate) || a.id - b.id,
    );
  let remaining = Math.round(amount);
  const allocations: AllocationResult["allocations"] = [];
  for (const inv of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, inv.netAmount - inv.paidAmount);
    allocations.push({ invoiceId: inv.id, amount: take });
    remaining -= take;
  }
  return { allocations, unallocated: remaining };
}
