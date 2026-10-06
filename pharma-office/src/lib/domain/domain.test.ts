import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, endOfMonth, parseISODate, startOfMonth, todayISO } from "./dates";
import { bonusForOffer, computeLine, sumLines } from "./pricing";
import { daysOverdue, outstandingOf, paymentStatus } from "./payment-status";
import { formatCompactNumber, formatIQDCompact, formatIQDExact, pctChange } from "./money";
import { allocateFifo } from "./allocation";

describe("dates", () => {
  it("does calendar arithmetic without timezone drift", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(daysBetween("2026-01-01", "2026-04-01")).toBe(90);
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29");
    expect(startOfMonth("2026-10-06")).toBe("2026-10-01");
  });
  it("computes today in Baghdad time", () => {
    // 22:30 UTC on Oct 5 is already Oct 6 in Baghdad (UTC+3).
    expect(todayISO(new Date("2026-10-05T22:30:00Z"))).toBe("2026-10-06");
  });
  it("rejects invalid dates", () => {
    expect(() => parseISODate("2026-02-30")).toThrow();
    expect(() => parseISODate("06/10/2026")).toThrow();
  });
});

describe("effective price", () => {
  it("matches the buy 10 get 2 example", () => {
    const l = computeLine({ quantity: 10, bonusQuantity: 2, unitPrice: 10_000, listPrice: 10_000, discountPct: 0 });
    expect(l.netAmount).toBe(100_000);
    expect(l.deliveredUnits).toBe(12);
    expect(l.effectiveUnitPrice).toBe(8_333);
    expect(l.commercialInvestment).toBe(20_000);
    expect(l.effectiveDiscountVsListPct).toBeCloseTo(16.67, 2);
  });
  it("combines discount and bonus", () => {
    const l = computeLine({ quantity: 100, bonusQuantity: 10, unitPrice: 6_500, listPrice: 6_500, discountPct: 5 });
    expect(l.grossAmount).toBe(650_000);
    expect(l.discountAmount).toBe(32_500);
    expect(l.netAmount).toBe(617_500);
    expect(l.effectiveUnitPrice).toBe(5_614);
  });
  it("validates inputs", () => {
    expect(() => computeLine({ quantity: 0, bonusQuantity: 0, unitPrice: 1, listPrice: 1, discountPct: 0 })).toThrow();
    expect(() => computeLine({ quantity: 1, bonusQuantity: -1, unitPrice: 1, listPrice: 1, discountPct: 0 })).toThrow();
    expect(() => computeLine({ quantity: 1, bonusQuantity: 0, unitPrice: 1, listPrice: 1, discountPct: 101 })).toThrow();
  });
  it("sums lines and computes offer bonus", () => {
    const a = computeLine({ quantity: 10, bonusQuantity: 0, unitPrice: 100, listPrice: 100, discountPct: 10 });
    expect(sumLines([a, a])).toEqual({ grossAmount: 2000, discountAmount: 200, netAmount: 1800 });
    expect(bonusForOffer(25, 10, 1)).toBe(2);
    expect(bonusForOffer(25, null, null)).toBe(0);
  });
});

describe("payment status", () => {
  const today = "2026-10-06";
  const inv = (dueDate: string, paidAmount = 0, isDisputed = false) => ({ dueDate, netAmount: 1000, paidAmount, isDisputed });
  it("distinguishes not-due from overdue", () => {
    expect(paymentStatus(inv("2026-12-01"), today)).toBe("not_due");
    expect(paymentStatus(inv("2026-10-01"), today)).toBe("overdue");
  });
  it("applies precedence", () => {
    expect(paymentStatus(inv("2026-10-01", 1000), today)).toBe("paid");
    expect(paymentStatus(inv("2026-10-01", 0, true), today)).toBe("disputed");
    expect(paymentStatus(inv("2026-10-06"), today)).toBe("due");
    expect(paymentStatus(inv("2026-10-13"), today)).toBe("due_soon");
    expect(paymentStatus(inv("2026-10-14"), today)).toBe("not_due");
    expect(paymentStatus(inv("2026-12-01", 400), today)).toBe("partially_paid");
    expect(paymentStatus(inv("2026-10-01", 400), today)).toBe("overdue");
  });
  it("computes outstanding and days overdue", () => {
    expect(outstandingOf({ netAmount: 1000, paidAmount: 250 })).toBe(750);
    expect(daysOverdue("2026-09-06", today)).toBe(30);
    expect(daysOverdue("2026-11-06", today)).toBe(0);
  });
});

describe("money formatting", () => {
  it("formats IQD compactly", () => {
    expect(formatIQDCompact(125_000_000)).toBe("IQD 125M");
    expect(formatIQDCompact(1_250_000_000)).toBe("IQD 1.25B");
    expect(formatIQDCompact(52_400_000)).toBe("IQD 52.4M");
    expect(formatIQDCompact(850_000)).toBe("IQD 850K");
    expect(formatIQDCompact(125_000_000, "ar")).toBe("125 مليون د.ع");
    expect(formatCompactNumber(-3_000_000)).toBe("-3M");
  });
  it("formats exact values and changes", () => {
    expect(formatIQDExact(125_000_000)).toBe("125,000,000");
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(5, 0)).toBeNull();
  });
});

describe("FIFO allocation", () => {
  const open = [
    { id: 1, dueDate: "2026-09-01", invoiceDate: "2026-06-03", netAmount: 500, paidAmount: 0, isDisputed: false },
    { id: 2, dueDate: "2026-08-01", invoiceDate: "2026-05-03", netAmount: 300, paidAmount: 100, isDisputed: false },
    { id: 3, dueDate: "2026-07-01", invoiceDate: "2026-04-03", netAmount: 900, paidAmount: 0, isDisputed: true },
  ];
  it("pays oldest due first and skips disputed invoices", () => {
    expect(allocateFifo(400, open)).toEqual({
      allocations: [
        { invoiceId: 2, amount: 200 },
        { invoiceId: 1, amount: 200 },
      ],
      unallocated: 0,
    });
  });
  it("keeps the remainder on account", () => {
    expect(allocateFifo(1000, open).unallocated).toBe(300);
    expect(allocateFifo(50, []).unallocated).toBe(50);
  });
  it("rejects non-positive amounts", () => {
    expect(() => allocateFifo(0, open)).toThrow();
  });
});
