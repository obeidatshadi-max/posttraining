/**
 * Deterministic demo-data generator. Pure: given `today` and a seed it always
 * returns the same dataset, so it can be unit-tested without a database.
 * All dates are generated relative to `today` so the dashboard is meaningful
 * whenever the seed is run.
 */
import type * as s from "../schema";
import { addDays, addMonths, daysBetween, endOfMonth, startOfMonth } from "@/lib/domain/dates";
import { bonusForOffer, computeLine } from "@/lib/domain/pricing";
import {
  COMPETITORS,
  DRUGSTORES,
  PHARMACIES,
  PRODUCTS,
  SCENARIO_PRODUCTS,
  TERRITORIES,
  USERS,
  type DemoUserKey,
} from "./catalog";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

export type DemoData = {
  territories: Insert<typeof s.territories>[];
  users: (Omit<Insert<typeof s.users>, "passwordHash"> & { id: string })[];
  drugstores: Insert<typeof s.drugstores>[];
  creditLimits: Insert<typeof s.creditLimits>[];
  pharmacies: Insert<typeof s.pharmacies>[];
  competitors: Insert<typeof s.competitors>[];
  products: Insert<typeof s.products>[];
  skus: Insert<typeof s.skus>[];
  batches: Insert<typeof s.batches>[];
  offers: Insert<typeof s.commercialOffers>[];
  offerItems: Insert<typeof s.offerItems>[];
  dataSources: Insert<typeof s.dataSources>[];
  invoices: (Insert<typeof s.salesInvoices> & { id: number; netAmount: number; paidAmount: number; invoiceDate: string; dueDate: string; drugstoreId: number; paymentTermDays: number })[];
  invoiceItems: Insert<typeof s.salesInvoiceItems>[];
  payments: Insert<typeof s.payments>[];
  allocations: Insert<typeof s.paymentAllocations>[];
  returns: Insert<typeof s.returns>[];
  returnItems: Insert<typeof s.returnItems>[];
  salesTargets: Insert<typeof s.salesTargets>[];
  marketSignals: Insert<typeof s.marketSignals>[];
  marketPrices: Insert<typeof s.marketPrices>[];
};

/** Mulberry32 PRNG — small, fast, deterministic. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuidFrom(rnd: () => number): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(rnd() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);
/** Global order-size multiplier calibrating demo volume (≈ IQD 0.4–0.6B sales per month). */
const VOLUME = 2.5;
const roundTo = (n: number, step: number) => Math.ceil(n / step) * step;

export function generateDemoData(today: string, seed = 20261006): DemoData {
  const rnd = createRng(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));

  // ── People & organisation ─────────────────────────────────────────────
  const userIds = Object.fromEntries(
    (Object.keys(USERS) as DemoUserKey[]).map((k) => [k, uuidFrom(rnd)]),
  ) as Record<DemoUserKey, string>;
  const users = (Object.keys(USERS) as DemoUserKey[]).map((k) => ({
    id: userIds[k],
    ...USERS[k],
    financialAccess: false,
    active: true,
  }));

  const termOf = (code: string) => (code === "DS-004" ? 60 : 90);
  const drugstores = DRUGSTORES.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    nameAr: d.nameAr,
    territoryId: d.territoryId,
    city: d.city,
    address: d.address,
    contactPerson: d.contactPerson,
    phone: d.phone,
    assignedRepId: userIds[d.rep],
    assignedManagerId: userIds[d.manager],
    paymentTermDays: termOf(d.code),
    active: true,
  }));

  // ── Products, SKUs, batches ───────────────────────────────────────────
  const productIdByCode = new Map(PRODUCTS.map((p, i) => [p.code, i + 1]));
  const products = PRODUCTS.map((p, i) => ({
    id: i + 1,
    code: p.code,
    name: p.name,
    nameAr: p.nameAr,
    genericName: p.genericName,
    strength: p.strength,
    dosageForm: p.dosageForm,
    therapeuticArea: p.therapeuticArea,
    isStrategic: p.isStrategic,
    active: true,
  }));
  const skus = PRODUCTS.map((p, i) => ({
    id: i + 1,
    productId: i + 1,
    code: `${p.code}-${p.packSize.split(" ")[0]}`,
    packSize: p.packSize,
    listPrice: p.listPrice,
    active: true,
  }));

  type BatchRow = Insert<typeof s.batches> & { id: number; skuId: number; expiryDate: string; receivedDate: string };
  const batches: BatchRow[] = [];
  let batchId = 0;
  for (const sku of skus) {
    for (let k = 0; k < 4; k++) {
      const receivedDate = addDays(today, -(420 - k * 120) + between(-10, 10));
      const yymm = receivedDate.slice(2, 4) + receivedDate.slice(5, 7);
      batches.push({
        id: ++batchId,
        skuId: sku.id,
        batchNumber: `B${yymm}-${String(sku.id).padStart(3, "0")}${String.fromCharCode(65 + k)}`,
        productionDate: addDays(receivedDate, -between(30, 90)),
        receivedDate,
        expiryDate: addMonths(receivedDate, between(24, 36)),
        quantityReceived: 0,
      });
    }
  }
  // Scenario: short-dated Glimetra batch (≈8 months of shelf life left).
  const expirySkuId = productIdByCode.get(SCENARIO_PRODUCTS.expiryExposure)!;
  const shortBatch: BatchRow = {
    id: ++batchId,
    skuId: expirySkuId,
    batchNumber: "B2311-007S",
    productionDate: addDays(today, -560),
    receivedDate: addDays(today, -200),
    expiryDate: addDays(today, 240),
    quantityReceived: 0,
  };
  batches.push(shortBatch);
  // Near-expiry Ondaset batch (expires in ≈75 days).
  const ondasetSku = productIdByCode.get("P035")!;
  batches.push({
    id: ++batchId,
    skuId: ondasetSku,
    batchNumber: "B2405-035N",
    productionDate: addDays(today, -800),
    receivedDate: addDays(today, -500),
    expiryDate: addDays(today, 75),
    quantityReceived: 0,
  });

  const batchesBySku = new Map<number, BatchRow[]>();
  for (const b of batches) {
    const list = batchesBySku.get(b.skuId) ?? [];
    list.push(b);
    batchesBySku.set(b.skuId, list);
  }
  const chooseBatch = (skuId: number, onDate: string): BatchRow | undefined =>
    (batchesBySku.get(skuId) ?? [])
      .filter((b) => b.receivedDate <= onDate && daysBetween(onDate, b.expiryDate) > 90)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];

  // ── Offers ────────────────────────────────────────────────────────────
  const glucotrinOffer = { id: 1, start: addDays(today, -120), end: addDays(today, 30) };
  const rosuvanOffer = { id: 2, start: addDays(today, -200), end: addDays(today, -60) };
  const offers = [
    {
      id: 1, code: "OFF-001", name: "Glucotrin diabetes campaign — buy 10 get 1",
      description: "Approved bonus offer on Glucotrin 500 mg.", startDate: glucotrinOffer.start, endDate: glucotrinOffer.end,
      discountPct: 0, bonusBuyQty: 10, bonusFreeQty: 1, approvedBy: userIds.director,
    },
    {
      id: 2, code: "OFF-002", name: "Rosuvan introductory discount 7%",
      description: "Temporary discount to support Rosuvan 10 mg uptake.", startDate: rosuvanOffer.start, endDate: rosuvanOffer.end,
      discountPct: 7, bonusBuyQty: null, bonusFreeQty: null, approvedBy: userIds.director,
    },
  ];
  const offerItems = [
    { offerId: 1, skuId: productIdByCode.get(SCENARIO_PRODUCTS.fastMoving)! },
    { offerId: 2, skuId: productIdByCode.get(SCENARIO_PRODUCTS.priceErosion)! },
  ];

  // ── Invoices ──────────────────────────────────────────────────────────
  type DraftLine = { productCode: string; qty: number; forceBatch?: BatchRow };
  type DraftInvoice = { drugstoreId: number; date: string; lines: DraftLine[]; disputed?: boolean };
  const drafts: DraftInvoice[] = [];
  const productWeight = (code: string) =>
    code === SCENARIO_PRODUCTS.fastMoving ? 4 : ["P002", "P003", "P004", "P010", "P020"].includes(code) ? 2 : 1;

  for (const d of DRUGSTORES) {
    for (let monthsAgo = 12; monthsAgo >= 0; monthsAgo--) {
      const monthStart = startOfMonth(addMonths(startOfMonth(today), -monthsAgo));
      const windowEnd = monthsAgo === 0 ? today : endOfMonth(monthStart);
      const days = daysBetween(monthStart, windowEnd) + 1;
      const expected = d.profile.invoicesPerMonth * d.profile.trend(monthsAgo) * (days / 30);
      const count = Math.floor(expected + rnd());
      for (let i = 0; i < count; i++) {
        const date = addDays(monthStart, Math.floor(rnd() * days));
        const age = daysBetween(date, today);
        const nLines = between(2, 4);
        const chosen = new Set<string>();
        const weighted = d.profile.products.flatMap((c) => Array(productWeight(c)).fill(c) as string[]);
        let guard = 0;
        while (chosen.size < nLines && guard++ < 50) {
          const code = pick(weighted);
          // Scenario: Osteval reorders fade in the last 4 months.
          if (code === SCENARIO_PRODUCTS.slowReorder && age < 120 && rnd() < 0.9) continue;
          // Scenario: no Glimetra reorder after the large short-dated purchase.
          if (code === SCENARIO_PRODUCTS.expiryExposure && (d.id === 1 || d.id === 10) && age < 165) continue;
          chosen.add(code);
        }
        const lines = [...chosen].map((code) => {
          const prod = PRODUCTS.find((p) => p.code === code)!;
          let qty = round10(prod.baseQty * VOLUME * d.profile.qtyScale * (0.6 + rnd() * 0.8));
          // Scenario: Babil keeps reordering Gastrozol strongly in the last 60 days.
          if (d.id === 6 && code === SCENARIO_PRODUCTS.inconsistency && age < 60) qty = round10(qty * 2.2);
          return { productCode: code, qty };
        });
        drafts.push({ drugstoreId: d.id, date, lines });
      }
    }
  }
  // Scenario: large short-dated Glimetra purchases ~147–150 days ago, never reordered.
  drafts.push({
    drugstoreId: 1,
    date: addDays(today, -147),
    lines: [{ productCode: SCENARIO_PRODUCTS.expiryExposure, qty: 800, forceBatch: shortBatch }, { productCode: "P002", qty: 200 }],
  });
  drafts.push({
    drugstoreId: 10,
    date: addDays(today, -150),
    lines: [{ productCode: SCENARIO_PRODUCTS.expiryExposure, qty: 900, forceBatch: shortBatch }, { productCode: "P004", qty: 240 }],
  });
  // Scenario: Babil — three large Gastrozol reorders within 60 days.
  for (const ago of [52, 31, 9]) {
    drafts.push({ drugstoreId: 6, date: addDays(today, -ago), lines: [{ productCode: SCENARIO_PRODUCTS.inconsistency, qty: 420 }] });
  }
  // Scenario: one disputed Tigris invoice (~110 days old).
  drafts.push({
    drugstoreId: 10,
    date: addDays(today, -110),
    lines: [{ productCode: "P003", qty: 150 }, { productCode: "P012", qty: 160 }],
    disputed: true,
  });

  drafts.sort((a, b) => a.date.localeCompare(b.date) || a.drugstoreId - b.drugstoreId);

  const invoices: (Insert<typeof s.salesInvoices> & { id: number; netAmount: number; paidAmount: number; invoiceDate: string; dueDate: string; drugstoreId: number })[] = [];
  const invoiceItems: (Insert<typeof s.salesInvoiceItems> & { invoiceId: number; skuId: number; quantity: number; bonusQuantity: number; netAmount: number })[] = [];
  const deliveredByBatch = new Map<number, number>();
  let itemId = 0;
  const seqByYear = new Map<string, number>();

  drafts.forEach((draft, idx) => {
    const id = idx + 1;
    const year = draft.date.slice(0, 4);
    const seq = (seqByYear.get(year) ?? 0) + 1;
    seqByYear.set(year, seq);
    const store = drugstores.find((x) => x.id === draft.drugstoreId)!;
    let offerId: number | null = null;
    let gross = 0;
    let discount = 0;
    let net = 0;
    for (const line of draft.lines) {
      const prod = PRODUCTS.find((p) => p.code === line.productCode)!;
      const skuId = productIdByCode.get(prod.code)!;
      const inGlucotrinOffer =
        prod.code === SCENARIO_PRODUCTS.fastMoving && draft.date >= glucotrinOffer.start && draft.date <= glucotrinOffer.end;
      const inRosuvanOffer =
        prod.code === SCENARIO_PRODUCTS.priceErosion && draft.date >= rosuvanOffer.start && draft.date <= rosuvanOffer.end;
      let discountPct = rnd() < 0.6 ? 0 : rnd() < 0.65 ? 5 : 10;
      let bonusQuantity = rnd() < 0.1 ? Math.floor(line.qty / 20) : 0;
      if (inGlucotrinOffer) {
        bonusQuantity = bonusForOffer(line.qty, 10, 1);
        offerId = 1;
      }
      if (inRosuvanOffer) {
        discountPct = 7;
        offerId = offerId ?? 2;
      }
      const unitPrice = rnd() < 0.92 ? prod.listPrice : Math.round((prod.listPrice * 0.95) / 50) * 50;
      const totals = computeLine({ quantity: line.qty, bonusQuantity, unitPrice, listPrice: prod.listPrice, discountPct });
      const batch = line.forceBatch ?? chooseBatch(skuId, draft.date);
      if (batch) deliveredByBatch.set(batch.id, (deliveredByBatch.get(batch.id) ?? 0) + line.qty + bonusQuantity);
      invoiceItems.push({
        id: ++itemId,
        invoiceId: id,
        skuId,
        batchId: batch?.id ?? null,
        quantity: line.qty,
        bonusQuantity,
        listPrice: prod.listPrice,
        unitPrice,
        discountPct,
        grossAmount: totals.grossAmount,
        discountAmount: totals.discountAmount,
        netAmount: totals.netAmount,
      });
      gross += totals.grossAmount;
      discount += totals.discountAmount;
      net += totals.netAmount;
    }
    const term = store.paymentTermDays;
    invoices.push({
      id,
      invoiceNumber: `INV-${year}-${String(seq).padStart(5, "0")}`,
      invoiceDate: draft.date,
      drugstoreId: draft.drugstoreId,
      repId: store.assignedRepId,
      offerId,
      paymentTermDays: term,
      dueDate: addDays(draft.date, term),
      grossAmount: gross,
      discountAmount: discount,
      netAmount: net,
      paidAmount: 0,
      isDisputed: Boolean(draft.disputed),
      disputeNote: draft.disputed ? "Drugstore disputes quantity received on one line; pending reconciliation." : null,
      createdBy: userIds.finance,
    });
  });

  for (const b of batches) {
    const delivered = deliveredByBatch.get(b.id) ?? 0;
    b.quantityReceived = delivered > 0 ? delivered + Math.round(delivered * (0.1 + rnd() * 0.3)) : between(500, 2000);
  }

  // ── Payments & allocations ────────────────────────────────────────────
  type PayEvent = { drugstoreId: number; date: string; amount: number; invoiceId: number };
  const events: PayEvent[] = [];
  for (const inv of invoices) {
    if (inv.isDisputed) continue;
    const profile = DRUGSTORES.find((d) => d.id === inv.drugstoreId)!.profile;
    const age = daysBetween(inv.invoiceDate, today);
    const payDays = profile.payDays(age, rnd);
    if (payDays === null) continue;
    const payDate = addDays(inv.invoiceDate, payDays);
    if (payDate > today) continue;
    if (rnd() < profile.partialProb) {
      const first = Math.round((inv.netAmount * (0.5 + rnd() * 0.3)) / 1000) * 1000;
      events.push({ drugstoreId: inv.drugstoreId, date: payDate, amount: first, invoiceId: inv.id });
      const secondDate = addDays(payDate, between(20, 40));
      if (secondDate <= today) {
        events.push({ drugstoreId: inv.drugstoreId, date: secondDate, amount: inv.netAmount - first, invoiceId: inv.id });
      }
    } else {
      events.push({ drugstoreId: inv.drugstoreId, date: payDate, amount: inv.netAmount, invoiceId: inv.id });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.invoiceId - b.invoiceId);
  const payments: Insert<typeof s.payments>[] = [];
  const allocations: Insert<typeof s.paymentAllocations>[] = [];
  const paySeq = new Map<string, number>();
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  events.forEach((e, idx) => {
    const id = idx + 1;
    const year = e.date.slice(0, 4);
    const seq = (paySeq.get(year) ?? 0) + 1;
    paySeq.set(year, seq);
    const r = rnd();
    const method = r < 0.5 ? "bank_transfer" : r < 0.8 ? "cheque" : "cash";
    const store = drugstores.find((x) => x.id === e.drugstoreId)!;
    payments.push({
      id,
      paymentNumber: `RCPT-${year}-${String(seq).padStart(5, "0")}`,
      drugstoreId: e.drugstoreId,
      paymentDate: e.date,
      amount: e.amount,
      method,
      reference: method === "cash" ? null : `${method === "cheque" ? "CHQ" : "TRF"}-${between(100000, 999999)}`,
      receivedBy: method === "cash" ? store.assignedRepId : userIds.finance,
      createdBy: userIds.finance,
    });
    allocations.push({ paymentId: id, invoiceId: e.invoiceId, amount: e.amount });
    const inv = invoiceById.get(e.invoiceId)!;
    inv.paidAmount += e.amount;
  });

  // ── Returns ───────────────────────────────────────────────────────────
  const returns: Insert<typeof s.returns>[] = [];
  const returnItems: Insert<typeof s.returnItems>[] = [];
  const yearAgo = addDays(today, -365);
  let returnId = 0;
  for (const d of DRUGSTORES) {
    const storeInvoices = invoices.filter((i) => i.drugstoreId === d.id && i.invoiceDate >= yearAgo);
    const annualSales = storeInvoices.reduce((a, i) => a + i.netAmount, 0);
    const targetValue = annualSales * d.profile.returnRate;
    const candidates = invoiceItems.filter((it) => {
      const inv = invoiceById.get(it.invoiceId)!;
      return inv.drugstoreId === d.id && daysBetween(inv.invoiceDate, today) > 75;
    });
    let returned = 0;
    let guard = 0;
    while (returned < targetValue && candidates.length && guard++ < 200) {
      const it = pick(candidates);
      const inv = invoiceById.get(it.invoiceId)!;
      const delivered = it.quantity + it.bonusQuantity;
      const qty = Math.max(5, Math.round(delivered * (0.2 + rnd() * 0.25)));
      const effective = it.netAmount / delivered;
      const value = Math.round(qty * effective);
      const returnDate = addDays(inv.invoiceDate, between(60, Math.min(220, daysBetween(inv.invoiceDate, today))));
      const r = rnd();
      const reason =
        d.profile.returnRate > 0.05
          ? r < 0.5 ? "near_expiry" : r < 0.8 ? "expiry" : "damaged"
          : r < 0.5 ? "damaged" : r < 0.75 ? "near_expiry" : "commercial";
      returnId++;
      returns.push({
        id: returnId,
        returnNumber: `RET-${returnDate.slice(0, 4)}-${String(returnId).padStart(4, "0")}`,
        drugstoreId: d.id,
        returnDate,
        reason,
        totalValue: value,
        creditNoteRef: `CN-${String(returnId).padStart(5, "0")}`,
        createdBy: userIds.finance,
      });
      returnItems.push({ returnId, skuId: it.skuId, batchId: it.batchId ?? null, quantity: qty, value, reason });
      returned += value;
    }
  }

  // ── Credit limits ─────────────────────────────────────────────────────
  const creditLimits: Insert<typeof s.creditLimits>[] = [];
  const currentFrom = addMonths(today, -6);
  for (const d of DRUGSTORES) {
    const exposure = invoices
      .filter((i) => i.drugstoreId === d.id)
      .reduce((a, i) => a + (i.netAmount - i.paidAmount), 0);
    const limit = Math.max(50_000_000, roundTo(exposure / d.profile.targetUtilisation, 10_000_000));
    if (d.id === 1) {
      creditLimits.push({
        drugstoreId: d.id, limitAmount: roundTo(limit * 0.75, 10_000_000), paymentTermDays: termOf(d.code),
        effectiveFrom: addDays(today, -730), effectiveTo: addDays(currentFrom, -1), approvedBy: userIds.director,
        notes: "Previous limit",
      });
    }
    creditLimits.push({
      drugstoreId: d.id, limitAmount: limit, paymentTermDays: termOf(d.code), effectiveFrom: currentFrom,
      effectiveTo: null, approvedBy: userIds.director, notes: d.id === 1 ? "Limit raised to support volume growth" : null,
    });
  }

  // ── Sales targets (per territory per month) ───────────────────────────
  const salesTargets: Insert<typeof s.salesTargets>[] = [];
  const territoryOf = new Map(drugstores.map((d) => [d.id, d.territoryId]));
  for (let monthsAgo = 12; monthsAgo >= 0; monthsAgo--) {
    const month = startOfMonth(addMonths(startOfMonth(today), -monthsAgo));
    for (const t of TERRITORIES) {
      const monthSales = (m: string) =>
        invoices
          .filter((i) => startOfMonth(i.invoiceDate) === m && territoryOf.get(i.drugstoreId) === t.id)
          .reduce((a, i) => a + i.netAmount, 0);
      let target: number;
      if (monthsAgo === 0) {
        const prev = [1, 2, 3].map((k) => monthSales(startOfMonth(addMonths(month, -k))));
        target = (prev.reduce((a, b) => a + b, 0) / 3) * 1.05;
      } else {
        target = monthSales(month) * (0.95 + rnd() * 0.15);
      }
      salesTargets.push({ month, territoryId: t.id, targetAmount: roundTo(Math.max(target, 10_000_000), 5_000_000) });
    }
  }

  // ── Market signals & prices (REPORTED) ────────────────────────────────
  const pid = (code: string) => productIdByCode.get(code)!;
  type SignalSpec = {
    ago: number; category: Insert<typeof s.marketSignals>["category"]; reporter: DemoUserKey;
    entity: Insert<typeof s.marketSignals>["sourceEntity"]; territoryId: number; city: string; area?: string;
    product?: string; drugstoreId?: number; pharmacyId?: number; competitorId?: number; observation: string;
    price?: number; quantity?: number; confidence: "low" | "medium" | "high"; status?: "open" | "validated" | "closed";
  };
  const specs: SignalSpec[] = [
    // Product D — price erosion reports in Baghdad (last two weeks)
    { ago: 2, category: "low_market_price", reporter: "repAli", entity: "sales_rep", territoryId: 1, city: "Baghdad", area: "Karrada", product: SCENARIO_PRODUCTS.priceErosion, pharmacyId: 1, observation: "Pharmacy reports being offered Rosuvan 10 mg by a wholesaler at IQD 10,000 per pack.", price: 10000, confidence: "medium" },
    { ago: 4, category: "low_market_price", reporter: "medSara", entity: "medical_rep", territoryId: 1, city: "Baghdad", area: "Al-Mansour", product: SCENARIO_PRODUCTS.priceErosion, pharmacyId: 2, observation: "Pharmacist mentions Rosuvan available at IQD 9,750 from a supplier.", price: 9750, confidence: "low" },
    { ago: 7, category: "low_market_price", reporter: "areaBaghdad", entity: "field_manager", territoryId: 1, city: "Baghdad", area: "Bab Al-Muadham", product: SCENARIO_PRODUCTS.priceErosion, pharmacyId: 3, observation: "Observed invoice at pharmacy showing Rosuvan 10 mg at IQD 10,250.", price: 10250, confidence: "high" },
    { ago: 10, category: "high_discount_observed", reporter: "repAli", entity: "pharmacy", territoryId: 1, city: "Baghdad", area: "Al-Adhamiya", product: SCENARIO_PRODUCTS.priceErosion, pharmacyId: 4, observation: "Pharmacy says Rosuvan comes with 1 free pack per 5 from a wholesaler.", confidence: "low" },
    { ago: 13, category: "low_market_price", reporter: "medSara", entity: "medical_rep", territoryId: 1, city: "Baghdad", area: "Karrada", product: SCENARIO_PRODUCTS.priceErosion, pharmacyId: 1, observation: "Second pharmacy in Karrada quoting Rosuvan at IQD 10,000.", price: 10000, confidence: "medium" },
    // Inconsistency — Babil reports slow Gastrozol while reordering strongly
    { ago: 20, category: "moving_slowly", reporter: "repZainab", entity: "drugstore", territoryId: 5, city: "Hillah", product: SCENARIO_PRODUCTS.inconsistency, drugstoreId: 6, observation: "Drugstore states Gastrozol 40 mg is moving slowly and their stock is high; asks for extra bonus.", confidence: "medium" },
    { ago: 44, category: "moving_slowly", reporter: "repZainab", entity: "drugstore", territoryId: 5, city: "Hillah", product: SCENARIO_PRODUCTS.inconsistency, drugstoreId: 6, observation: "Drugstore reports weak Gastrozol demand from pharmacies.", confidence: "low" },
    // Product C — possible expiry exposure for Glimetra
    { ago: 30, category: "moving_slowly", reporter: "medSara", entity: "medical_rep", territoryId: 1, city: "Baghdad", area: "Al-Adhamiya", product: SCENARIO_PRODUCTS.expiryExposure, pharmacyId: 4, observation: "Pharmacies in Adhamiya say Glimetra 1 mg prescriptions are low; shelves still stocked.", confidence: "medium" },
    { ago: 12, category: "near_expiry_concern", reporter: "repAli", entity: "drugstore", territoryId: 1, city: "Baghdad", product: SCENARIO_PRODUCTS.expiryExposure, drugstoreId: 10, observation: "Tigris mentions Glimetra stock from batch B2311-007S and asks about return options.", confidence: "medium" },
    { ago: 22, category: "moving_slowly", reporter: "repAli", entity: "sales_rep", territoryId: 1, city: "Baghdad", product: SCENARIO_PRODUCTS.expiryExposure, drugstoreId: 1, observation: "Al-Noor did not include Glimetra in recent orders; says pharmacies are not asking for it.", confidence: "medium" },
    // Product A — fast moving / availability
    { ago: 6, category: "moving_strongly", reporter: "repZainab", entity: "sales_rep", territoryId: 2, city: "Basra", product: SCENARIO_PRODUCTS.fastMoving, drugstoreId: 3, observation: "Glucotrin demand strong across Basra pharmacies.", confidence: "medium" },
    { ago: 8, category: "availability_issue", reporter: "areaSouth", entity: "pharmacy", territoryId: 2, city: "Basra", area: "Al-Jazair", product: SCENARIO_PRODUCTS.fastMoving, pharmacyId: 6, observation: "Pharmacy could not obtain Glucotrin for 5 days.", confidence: "low" },
    { ago: 15, category: "moving_strongly", reporter: "medYousif", entity: "medical_rep", territoryId: 5, city: "Karbala", product: SCENARIO_PRODUCTS.fastMoving, pharmacyId: 10, observation: "Physicians increasingly prescribing Glucotrin; pharmacies report steady sell-out.", confidence: "medium" },
    // Competitors
    { ago: 25, category: "competitor_offer", reporter: "repOmar", entity: "sales_rep", territoryId: 4, city: "Mosul", product: SCENARIO_PRODUCTS.fastMoving, drugstoreId: 5, competitorId: 1, observation: "Competitor Alpha offering metformin with 20% bonus to drugstores in Mosul.", confidence: "medium" },
    { ago: 40, category: "new_competitor", reporter: "repOmar", entity: "drugstore", territoryId: 4, city: "Mosul", product: SCENARIO_PRODUCTS.slowReorder, drugstoreId: 5, competitorId: 3, observation: "Drugstore mentions a cheaper alendronate alternative now available locally.", confidence: "low" },
    { ago: 18, category: "competitor_offer", reporter: "areaBaghdad", entity: "field_manager", territoryId: 1, city: "Baghdad", product: "P003", competitorId: 2, observation: "Competitor Beta running an atorvastatin campaign with pharmacy incentives.", confidence: "medium" },
    // Other field intelligence
    { ago: 18, category: "other", reporter: "repOmar", entity: "drugstore", territoryId: 3, city: "Sulaymaniyah", drugstoreId: 8, observation: "Drugstore attributes payment delays to slow collections from its own customers.", confidence: "low" },
    { ago: 10, category: "unusual_movement", reporter: "medYousif", entity: "medical_rep", territoryId: 5, city: "Najaf", drugstoreId: 7, observation: "Higher-than-usual volumes of several products observed leaving Najaf towards other provinces. Requires verification.", confidence: "low" },
    { ago: 50, category: "pharmacy_complaint", reporter: "medYousif", entity: "pharmacy", territoryId: 5, city: "Hillah", product: "P022", pharmacyId: 12, observation: "Complaint about damaged outer cartons on Ceftrix 1 g.", confidence: "medium", status: "closed" },
    { ago: 65, category: "drugstore_supply_issue", reporter: "repZainab", entity: "pharmacy", territoryId: 2, city: "Basra", drugstoreId: 3, observation: "Pharmacies report delayed deliveries from the drugstore.", confidence: "low", status: "closed" },
    { ago: 35, category: "near_expiry_concern", reporter: "repZainab", entity: "drugstore", territoryId: 2, city: "Basra", product: "P035", drugstoreId: 3, observation: "Drugstore holds Ondaset with short remaining shelf life; requests return.", confidence: "medium", status: "validated" },
    { ago: 3, category: "product_unavailable", reporter: "medSara", entity: "pharmacy", territoryId: 1, city: "Baghdad", area: "Karrada", product: "P008", pharmacyId: 1, observation: "Pharmacy unable to find Sitaglen 100 mg this week.", confidence: "low" },
  ];
  const marketSignals: Insert<typeof s.marketSignals>[] = specs.map((sp) => {
    const date = addDays(today, -sp.ago);
    return {
      signalDate: date,
      category: sp.category,
      reporterId: userIds[sp.reporter],
      reporterRole: USERS[sp.reporter].role,
      territoryId: sp.territoryId,
      city: sp.city,
      area: sp.area ?? null,
      productId: sp.product ? pid(sp.product) : null,
      drugstoreId: sp.drugstoreId ?? null,
      pharmacyId: sp.pharmacyId ?? null,
      competitorId: sp.competitorId ?? null,
      observation: sp.observation,
      observedPrice: sp.price ?? null,
      quantity: sp.quantity ?? null,
      status: sp.status ?? "open",
      sourceType: "reported",
      sourceEntity: sp.entity,
      sourceDate: date,
      confidence: sp.confidence,
    };
  });
  const marketPrices: Insert<typeof s.marketPrices>[] = specs
    .filter((sp) => sp.price && sp.product)
    .map((sp) => ({
      observedDate: addDays(today, -sp.ago),
      productId: pid(sp.product!),
      skuId: pid(sp.product!),
      pharmacyId: sp.pharmacyId ?? null,
      drugstoreId: sp.drugstoreId ?? null,
      territoryId: sp.territoryId,
      reporterId: userIds[sp.reporter],
      marketPrice: sp.price!,
      sourceType: "reported" as const,
      sourceEntity: sp.entity,
      sourceDate: addDays(today, -sp.ago),
      confidence: sp.confidence,
      evidenceReference: sp.observation,
    }));
  // Baseline (older) Rosuvan prices for comparison.
  for (const ago of [120, 90, 60]) {
    marketPrices.push({
      observedDate: addDays(today, -ago), productId: pid(SCENARIO_PRODUCTS.priceErosion), skuId: pid(SCENARIO_PRODUCTS.priceErosion),
      pharmacyId: 1, territoryId: 1, reporterId: userIds.repAli, marketPrice: 14000, sourceType: "reported",
      sourceEntity: "sales_rep", sourceDate: addDays(today, -ago), confidence: "medium", evidenceReference: "Routine price check",
    });
  }

  const dataSources = [
    { id: 1, name: "Manual entry", kind: "manual" as const, description: "Invoices and payments entered through the application forms." },
    { id: 2, name: "Demo seed", kind: "demo_seed" as const, description: "Fictional demonstration dataset." },
  ];

  return {
    territories: TERRITORIES.map((t) => ({ ...t })),
    users,
    drugstores,
    creditLimits,
    pharmacies: PHARMACIES.map((p) => ({ ...p })),
    competitors: COMPETITORS.map((c) => ({ ...c })),
    products,
    skus,
    batches,
    offers,
    offerItems,
    dataSources,
    invoices,
    invoiceItems,
    payments,
    allocations,
    returns,
    returnItems,
    salesTargets,
    marketSignals,
    marketPrices,
  };
}
