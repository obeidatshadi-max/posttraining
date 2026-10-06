/**
 * Commercial pricing maths for invoice lines.
 *
 * Effective net price answers: "what did each delivered pack really cost the
 * drugstore once discounts AND bonus / free goods are included?"
 *
 *   gross            = paid qty × invoice unit price
 *   discount         = gross × discount%
 *   net              = gross − discount
 *   delivered units  = paid qty + bonus qty
 *   effective price  = net ÷ delivered units
 *
 * Example: buy 10 get 2 free at 10,000 IQD, no discount →
 *   net 100,000 / 12 delivered = 8,333 IQD effective per pack.
 */
export type LineInput = {
  quantity: number;
  bonusQuantity: number;
  unitPrice: number;
  listPrice: number;
  discountPct: number;
};

export type LineTotals = {
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  deliveredUnits: number;
  /** IQD per delivered pack, rounded to whole dinars. */
  effectiveUnitPrice: number;
  /** Total commercial investment vs list price, as a % of list value of delivered goods. */
  effectiveDiscountVsListPct: number;
  /** List value of all delivered packs minus what is actually charged. */
  commercialInvestment: number;
};

export function computeLine(input: LineInput): LineTotals {
  const { quantity, bonusQuantity, unitPrice, listPrice, discountPct } = input;
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive integer");
  if (!Number.isInteger(bonusQuantity) || bonusQuantity < 0) throw new Error("Bonus quantity must be ≥ 0");
  if (unitPrice < 0 || listPrice < 0) throw new Error("Prices must be ≥ 0");
  if (discountPct < 0 || discountPct > 100) throw new Error("Discount must be between 0 and 100");

  const grossAmount = Math.round(quantity * unitPrice);
  const discountAmount = Math.round((grossAmount * discountPct) / 100);
  const netAmount = grossAmount - discountAmount;
  const deliveredUnits = quantity + bonusQuantity;
  const effectiveUnitPrice = Math.round(netAmount / deliveredUnits);
  const listValueDelivered = deliveredUnits * listPrice;
  const commercialInvestment = Math.max(0, listValueDelivered - netAmount);
  const effectiveDiscountVsListPct =
    listValueDelivered > 0 ? round2((commercialInvestment / listValueDelivered) * 100) : 0;

  return {
    grossAmount,
    discountAmount,
    netAmount,
    deliveredUnits,
    effectiveUnitPrice,
    effectiveDiscountVsListPct,
    commercialInvestment,
  };
}

export function sumLines(lines: LineTotals[]) {
  return lines.reduce(
    (acc, l) => ({
      grossAmount: acc.grossAmount + l.grossAmount,
      discountAmount: acc.discountAmount + l.discountAmount,
      netAmount: acc.netAmount + l.netAmount,
    }),
    { grossAmount: 0, discountAmount: 0, netAmount: 0 },
  );
}

/** Bonus packs earned under a "buy X get Y" offer. */
export function bonusForOffer(quantity: number, buyQty: number | null, freeQty: number | null): number {
  if (!buyQty || !freeQty || buyQty <= 0) return 0;
  return Math.floor(quantity / buyQty) * freeQty;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
