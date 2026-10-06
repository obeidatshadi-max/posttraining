import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "@/lib/domain/dates";
import { computeLine } from "@/lib/domain/pricing";
import { generateDemoData } from "./generate";

const TODAY = "2026-10-06";
const data = generateDemoData(TODAY);

describe("demo data generator", () => {
  it("is deterministic", () => {
    const again = generateDemoData(TODAY);
    expect(again.invoices.length).toBe(data.invoices.length);
    expect(again.invoices[17]).toEqual(data.invoices[17]);
    expect(again.users.map((u) => u.id)).toEqual(data.users.map((u) => u.id));
  });

  it("matches the requested demo scale", () => {
    expect(data.drugstores).toHaveLength(10);
    expect(data.products).toHaveLength(40);
    expect(data.batches.length).toBeGreaterThanOrEqual(120);
    const first = data.invoices.map((i) => i.invoiceDate).sort()[0];
    expect(daysBetween(first!, TODAY)).toBeGreaterThanOrEqual(365);
    expect(data.marketSignals.every((s) => s.sourceType === "reported")).toBe(true);
  });

  it("keeps invoice totals consistent with their lines", () => {
    for (const inv of data.invoices) {
      const lines = data.invoiceItems.filter((it) => it.invoiceId === inv.id);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.reduce((a, l) => a + l.netAmount, 0)).toBe(inv.netAmount);
      for (const l of lines) {
        const c = computeLine({
          quantity: l.quantity, bonusQuantity: l.bonusQuantity ?? 0, unitPrice: l.unitPrice,
          listPrice: l.listPrice, discountPct: l.discountPct ?? 0,
        });
        expect(c.netAmount).toBe(l.netAmount);
      }
      expect(inv.dueDate).toBe(addDays(inv.invoiceDate, inv.paymentTermDays));
    }
  });

  it("never over-allocates payments and never pays in the future", () => {
    for (const inv of data.invoices) {
      expect(inv.paidAmount).toBeGreaterThanOrEqual(0);
      expect(inv.paidAmount).toBeLessThanOrEqual(inv.netAmount);
    }
    expect(data.payments.every((p) => p.paymentDate <= TODAY)).toBe(true);
    const paid = data.allocations.reduce((a, x) => a + x.amount, 0);
    expect(paid).toBe(data.invoices.reduce((a, i) => a + i.paidAmount, 0));
  });

  it("only sells batches already received and not within 90 days of expiry", () => {
    const batchById = new Map(data.batches.map((b) => [b.id, b]));
    for (const it of data.invoiceItems) {
      if (!it.batchId) continue;
      const b = batchById.get(it.batchId)!;
      const inv = data.invoices.find((i) => i.id === it.invoiceId)!;
      expect(b.skuId).toBe(it.skuId);
      expect(b.receivedDate <= inv.invoiceDate).toBe(true);
      expect(b.expiryDate > inv.invoiceDate).toBe(true);
    }
  });

  it("contains the key demo scenarios", () => {
    const outstanding = (id: number) =>
      data.invoices.filter((i) => i.drugstoreId === id).reduce((a, i) => a + i.netAmount - i.paidAmount, 0);
    const overdue = (id: number) =>
      data.invoices
        .filter((i) => i.drugstoreId === id && i.dueDate < TODAY)
        .reduce((a, i) => a + i.netAmount - i.paidAmount, 0);
    // B: Al-Noor — high outstanding with overdue balance.
    expect(outstanding(1)).toBeGreaterThan(outstanding(2));
    expect(overdue(1)).toBeGreaterThan(0);
    // D: Ibn Sina — strong payer, nothing overdue.
    expect(overdue(4)).toBe(0);
    // Collection deterioration at Kurdistan Medical.
    expect(overdue(8)).toBeGreaterThan(0);
    // High return behaviour at Dar Al-Dawaa.
    const returnsOf = (id: number) => data.returns.filter((r) => r.drugstoreId === id).reduce((a, r) => a + r.totalValue, 0);
    expect(returnsOf(3)).toBeGreaterThan(returnsOf(2) * 3);
    // A disputed invoice exists.
    expect(data.invoices.some((i) => i.isDisputed)).toBe(true);
  });
});
