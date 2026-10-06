/**
 * Database schema for the Scientific Office commercial intelligence platform.
 *
 * Conventions
 * - Money is stored in whole Iraqi Dinars (IQD) as BIGINT. IQD has no
 *   fractional unit in practical commercial use.
 * - Percentages are NUMERIC(5,2) (e.g. 12.50 = 12.5%).
 * - Every intelligence record (market signals, prices, alerts, metrics)
 *   carries data lineage: source_type / source_entity / source_date /
 *   confidence / evidence_reference. Commercial records owned by the
 *   Scientific Office (invoices, payments, returns, credit limits) are
 *   CONFIRMED by definition.
 * - The platform models the Office's relationship with drugstores only.
 *   It deliberately has no tables for drugstore-internal stock, pharmacy
 *   invoices or drugstore accounting.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRole = pgEnum("user_role", [
  "director",
  "sales_manager",
  "area_manager",
  "sales_rep",
  "medical_rep",
  "finance",
  "admin",
]);

/** CONFIRMED vs REPORTED vs ESTIMATED — the platform's central principle. */
export const sourceType = pgEnum("source_type", ["confirmed", "reported", "estimated"]);

export const sourceEntity = pgEnum("source_entity", [
  "invoice",
  "payment",
  "return",
  "credit_limit",
  "offer",
  "sales_rep",
  "medical_rep",
  "field_manager",
  "manager",
  "drugstore",
  "pharmacy",
  "market_observation",
  "algorithm",
  "import",
]);

export const confidenceLevel = pgEnum("confidence_level", ["low", "medium", "high"]);
export const severityLevel = pgEnum("severity_level", ["low", "medium", "high", "critical"]);
export const alertStatus = pgEnum("alert_status", [
  "new",
  "investigating",
  "actioned",
  "resolved",
  "dismissed",
]);
export const alertCategory = pgEnum("alert_category", [
  "financial",
  "commercial",
  "product",
  "market",
  "information",
]);
export const paymentMethod = pgEnum("payment_method", ["cash", "bank_transfer", "cheque", "other"]);
export const returnReason = pgEnum("return_reason", [
  "expiry",
  "near_expiry",
  "damaged",
  "commercial",
  "other",
]);
export const signalCategory = pgEnum("signal_category", [
  "product_unavailable",
  "moving_strongly",
  "moving_slowly",
  "low_market_price",
  "high_discount_observed",
  "competitor_offer",
  "pharmacy_complaint",
  "drugstore_supply_issue",
  "availability_issue",
  "unusual_movement",
  "suspected_parallel_movement",
  "near_expiry_concern",
  "new_competitor",
  "other",
]);
export const signalStatus = pgEnum("signal_status", ["open", "validated", "closed"]);
export const taskStatus = pgEnum("task_status", ["open", "in_progress", "done", "cancelled"]);
export const importStatus = pgEnum("import_status", ["pending", "processing", "completed", "failed"]);
export const dataSourceKind = pgEnum("data_source_kind", ["manual", "csv", "excel", "api", "demo_seed"]);
export const collectionActivityType = pgEnum("collection_activity_type", [
  "call",
  "visit",
  "promise_to_pay",
  "dispute",
  "note",
]);

// Shared lineage columns for intelligence records.
const lineage = () => ({
  sourceType: sourceType("source_type").notNull(),
  sourceEntity: sourceEntity("source_entity").notNull(),
  sourceDate: date("source_date").notNull(),
  confidence: confidenceLevel("confidence").notNull(),
  evidenceReference: text("evidence_reference"),
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: "number" });

// ─── Organisation & people ───────────────────────────────────────────────────

export const territories = pgTable("territories", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    fullNameAr: text("full_name_ar"),
    role: userRole("role").notNull(),
    territoryId: integer("territory_id").references(() => territories.id),
    /** Explicit grant for roles that do not see financials by default (e.g. medical reps). */
    financialAccess: boolean("financial_access").notNull().default(false),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)],
);

// ─── Customers (drugstores) and the wider market ─────────────────────────────

export const drugstores = pgTable(
  "drugstores",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull(),
    territoryId: integer("territory_id")
      .notNull()
      .references(() => territories.id),
    city: text("city").notNull(),
    address: text("address"),
    contactPerson: text("contact_person"),
    phone: varchar("phone", { length: 32 }),
    assignedRepId: uuid("assigned_rep_id").references(() => users.id),
    assignedManagerId: uuid("assigned_manager_id").references(() => users.id),
    /** Default agreed payment term in days (commonly 90 in Iraq). */
    paymentTermDays: integer("payment_term_days").notNull().default(90),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("drugstores_territory_idx").on(t.territoryId),
    index("drugstores_rep_idx").on(t.assignedRepId),
  ],
);

/** History of approved credit limits. The current limit has effective_to IS NULL. */
export const creditLimits = pgTable(
  "credit_limits",
  {
    id: serial("id").primaryKey(),
    drugstoreId: integer("drugstore_id")
      .notNull()
      .references(() => drugstores.id),
    limitAmount: money("limit_amount").notNull(),
    paymentTermDays: integer("payment_term_days").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    approvedBy: uuid("approved_by").references(() => users.id),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("credit_limits_drugstore_idx").on(t.drugstoreId, t.effectiveFrom),
    check("credit_limits_amount_chk", sql`${t.limitAmount} >= 0`),
  ],
);

export const pharmacies = pgTable(
  "pharmacies",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    nameAr: text("name_ar"),
    territoryId: integer("territory_id").references(() => territories.id),
    city: text("city"),
    area: text("area"),
    createdAt: createdAt(),
  },
  (t) => [index("pharmacies_territory_idx").on(t.territoryId)],
);

export const competitors = pgTable("competitors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  notes: text("notes"),
  createdAt: createdAt(),
});

// ─── Products ────────────────────────────────────────────────────────────────

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  genericName: text("generic_name").notNull(),
  strength: text("strength"),
  dosageForm: text("dosage_form"),
  therapeuticArea: text("therapeutic_area"),
  isStrategic: boolean("is_strategic").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const skus = pgTable(
  "skus",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    code: varchar("code", { length: 48 }).notNull().unique(),
    packSize: text("pack_size").notNull(),
    /** Official list price per pack to drugstores, IQD. */
    listPrice: money("list_price").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("skus_product_idx").on(t.productId)],
);

export const batches = pgTable(
  "batches",
  {
    id: serial("id").primaryKey(),
    skuId: integer("sku_id")
      .notNull()
      .references(() => skus.id),
    batchNumber: varchar("batch_number", { length: 48 }).notNull(),
    productionDate: date("production_date"),
    expiryDate: date("expiry_date").notNull(),
    /** Packs received by the Scientific Office. */
    quantityReceived: integer("quantity_received").notNull(),
    receivedDate: date("received_date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("batches_sku_batch_idx").on(t.skuId, t.batchNumber),
    index("batches_expiry_idx").on(t.expiryDate),
  ],
);

// ─── Commercial offers ───────────────────────────────────────────────────────

export const commercialOffers = pgTable("commercial_offers", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
  /** "Buy X get Y": bonus_free_qty free packs for every bonus_buy_qty paid packs. */
  bonusBuyQty: integer("bonus_buy_qty"),
  bonusFreeQty: integer("bonus_free_qty"),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: createdAt(),
});

export const offerItems = pgTable(
  "offer_items",
  {
    id: serial("id").primaryKey(),
    offerId: integer("offer_id")
      .notNull()
      .references(() => commercialOffers.id, { onDelete: "cascade" }),
    skuId: integer("sku_id")
      .notNull()
      .references(() => skus.id),
  },
  (t) => [uniqueIndex("offer_items_offer_sku_idx").on(t.offerId, t.skuId)],
);

// ─── Data imports (declared before invoices so they can reference it) ─────────

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  kind: dataSourceKind("kind").notNull(),
  description: text("description"),
  createdAt: createdAt(),
});

export const imports = pgTable("imports", {
  id: serial("id").primaryKey(),
  dataSourceId: integer("data_source_id").references(() => dataSources.id),
  entity: varchar("entity", { length: 64 }).notNull(),
  fileName: text("file_name"),
  status: importStatus("status").notNull().default("pending"),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsOk: integer("rows_ok").notNull().default(0),
  rowsFailed: integer("rows_failed").notNull().default(0),
  errors: jsonb("errors").$type<{ row: number; message: string }[]>(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: createdAt(),
});

// ─── Sales ───────────────────────────────────────────────────────────────────

export const salesInvoices = pgTable(
  "sales_invoices",
  {
    id: serial("id").primaryKey(),
    invoiceNumber: varchar("invoice_number", { length: 48 }).notNull().unique(),
    invoiceDate: date("invoice_date").notNull(),
    drugstoreId: integer("drugstore_id")
      .notNull()
      .references(() => drugstores.id),
    repId: uuid("rep_id").references(() => users.id),
    offerId: integer("offer_id").references(() => commercialOffers.id),
    paymentTermDays: integer("payment_term_days").notNull(),
    dueDate: date("due_date").notNull(),
    /** Totals are derived from items and maintained transactionally on write. */
    grossAmount: money("gross_amount").notNull(),
    discountAmount: money("discount_amount").notNull(),
    netAmount: money("net_amount").notNull(),
    /** Sum of payment allocations. Maintained transactionally with payment_allocations. */
    paidAmount: money("paid_amount").notNull().default(0),
    isDisputed: boolean("is_disputed").notNull().default(false),
    disputeNote: text("dispute_note"),
    notes: text("notes"),
    importId: integer("import_id").references(() => imports.id),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("invoices_drugstore_idx").on(t.drugstoreId, t.invoiceDate),
    index("invoices_date_idx").on(t.invoiceDate),
    index("invoices_due_idx").on(t.dueDate),
    index("invoices_rep_idx").on(t.repId),
    // Partial index for the hot "open receivables" queries.
    index("invoices_open_idx")
      .on(t.drugstoreId, t.dueDate)
      .where(sql`${t.paidAmount} < ${t.netAmount}`),
    check("invoices_amounts_chk", sql`${t.netAmount} >= 0 AND ${t.paidAmount} >= 0 AND ${t.paidAmount} <= ${t.netAmount}`),
    check("invoices_due_chk", sql`${t.dueDate} >= ${t.invoiceDate}`),
  ],
);

export const salesInvoiceItems = pgTable(
  "sales_invoice_items",
  {
    id: serial("id").primaryKey(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    skuId: integer("sku_id")
      .notNull()
      .references(() => skus.id),
    batchId: integer("batch_id").references(() => batches.id),
    /** Paid packs. */
    quantity: integer("quantity").notNull(),
    /** Free packs delivered (bonus / free goods). */
    bonusQuantity: integer("bonus_quantity").notNull().default(0),
    /** Official list price at time of sale, IQD per pack. */
    listPrice: money("list_price").notNull(),
    /** Invoice price per paid pack before discount, IQD. */
    unitPrice: money("unit_price").notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
    grossAmount: money("gross_amount").notNull(),
    discountAmount: money("discount_amount").notNull(),
    netAmount: money("net_amount").notNull(),
  },
  (t) => [
    index("invoice_items_invoice_idx").on(t.invoiceId),
    index("invoice_items_sku_idx").on(t.skuId),
    index("invoice_items_batch_idx").on(t.batchId),
    check("invoice_items_qty_chk", sql`${t.quantity} > 0 AND ${t.bonusQuantity} >= 0`),
    check("invoice_items_discount_chk", sql`${t.discountPct} >= 0 AND ${t.discountPct} <= 100`),
  ],
);

/** Monthly sales targets (optionally per territory). Used for "vs target" KPIs. */
export const salesTargets = pgTable(
  "sales_targets",
  {
    id: serial("id").primaryKey(),
    month: date("month").notNull(),
    territoryId: integer("territory_id").references(() => territories.id),
    targetAmount: money("target_amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sales_targets_month_idx").on(t.month)],
);

// ─── Collections ─────────────────────────────────────────────────────────────

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    paymentNumber: varchar("payment_number", { length: 48 }).notNull().unique(),
    drugstoreId: integer("drugstore_id")
      .notNull()
      .references(() => drugstores.id),
    paymentDate: date("payment_date").notNull(),
    amount: money("amount").notNull(),
    method: paymentMethod("method").notNull(),
    reference: text("reference"),
    notes: text("notes"),
    receivedBy: uuid("received_by").references(() => users.id),
    importId: integer("import_id").references(() => imports.id),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_drugstore_idx").on(t.drugstoreId, t.paymentDate),
    index("payments_date_idx").on(t.paymentDate),
    check("payments_amount_chk", sql`${t.amount} > 0`),
  ],
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: serial("id").primaryKey(),
    paymentId: integer("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => salesInvoices.id),
    amount: money("amount").notNull(),
  },
  (t) => [
    index("allocations_payment_idx").on(t.paymentId),
    index("allocations_invoice_idx").on(t.invoiceId),
    check("allocations_amount_chk", sql`${t.amount} > 0`),
  ],
);

/** Collection follow-up activity log (calls, visits, promises to pay). */
export const collections = pgTable(
  "collections",
  {
    id: serial("id").primaryKey(),
    drugstoreId: integer("drugstore_id")
      .notNull()
      .references(() => drugstores.id),
    userId: uuid("user_id").references(() => users.id),
    activityDate: date("activity_date").notNull(),
    activityType: collectionActivityType("activity_type").notNull(),
    promisedAmount: money("promised_amount"),
    promisedDate: date("promised_date"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("collections_drugstore_idx").on(t.drugstoreId, t.activityDate)],
);

// ─── Returns ─────────────────────────────────────────────────────────────────

export const returns = pgTable(
  "returns",
  {
    id: serial("id").primaryKey(),
    returnNumber: varchar("return_number", { length: 48 }).notNull().unique(),
    drugstoreId: integer("drugstore_id")
      .notNull()
      .references(() => drugstores.id),
    returnDate: date("return_date").notNull(),
    reason: returnReason("reason").notNull(),
    totalValue: money("total_value").notNull(),
    creditNoteRef: text("credit_note_ref"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("returns_drugstore_idx").on(t.drugstoreId, t.returnDate)],
);

export const returnItems = pgTable(
  "return_items",
  {
    id: serial("id").primaryKey(),
    returnId: integer("return_id")
      .notNull()
      .references(() => returns.id, { onDelete: "cascade" }),
    skuId: integer("sku_id")
      .notNull()
      .references(() => skus.id),
    batchId: integer("batch_id").references(() => batches.id),
    quantity: integer("quantity").notNull(),
    value: money("value").notNull(),
    reason: returnReason("reason").notNull(),
  },
  (t) => [index("return_items_return_idx").on(t.returnId), index("return_items_sku_idx").on(t.skuId)],
);

// ─── Market intelligence (REPORTED by default) ───────────────────────────────

export const marketSignals = pgTable(
  "market_signals",
  {
    id: serial("id").primaryKey(),
    signalDate: date("signal_date").notNull(),
    category: signalCategory("category").notNull(),
    reporterId: uuid("reporter_id").references(() => users.id),
    reporterRole: userRole("reporter_role"),
    territoryId: integer("territory_id").references(() => territories.id),
    city: text("city"),
    area: text("area"),
    productId: integer("product_id").references(() => products.id),
    drugstoreId: integer("drugstore_id").references(() => drugstores.id),
    pharmacyId: integer("pharmacy_id").references(() => pharmacies.id),
    competitorId: integer("competitor_id").references(() => competitors.id),
    observation: text("observation").notNull(),
    observedPrice: money("observed_price"),
    quantity: integer("quantity"),
    photoUrl: text("photo_url"),
    voiceNoteUrl: text("voice_note_url"),
    status: signalStatus("status").notNull().default("open"),
    ...lineage(),
    createdAt: createdAt(),
  },
  (t) => [
    index("signals_date_idx").on(t.signalDate),
    index("signals_product_idx").on(t.productId),
    index("signals_drugstore_idx").on(t.drugstoreId),
    index("signals_territory_idx").on(t.territoryId),
  ],
);

export const marketPrices = pgTable(
  "market_prices",
  {
    id: serial("id").primaryKey(),
    observedDate: date("observed_date").notNull(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    skuId: integer("sku_id").references(() => skus.id),
    pharmacyId: integer("pharmacy_id").references(() => pharmacies.id),
    drugstoreId: integer("drugstore_id").references(() => drugstores.id),
    territoryId: integer("territory_id").references(() => territories.id),
    reporterId: uuid("reporter_id").references(() => users.id),
    /** Observed market price per pack, IQD. */
    marketPrice: money("market_price").notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2, mode: "number" }),
    bonusNote: text("bonus_note"),
    ...lineage(),
    createdAt: createdAt(),
  },
  (t) => [index("market_prices_product_idx").on(t.productId, t.observedDate)],
);

// ─── Risk engine & workflow ──────────────────────────────────────────────────

export type EvidenceItem = {
  label: string;
  value?: string;
  sourceType: "confirmed" | "reported" | "estimated";
  sourceEntity?: string;
  date?: string;
  reference?: string;
};

export const alerts = pgTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    /** Stable key so the engine can upsert rather than duplicate alerts. */
    dedupeKey: varchar("dedupe_key", { length: 160 }).notNull().unique(),
    category: alertCategory("category").notNull(),
    alertType: varchar("alert_type", { length: 64 }).notNull(),
    title: text("title").notNull(),
    severity: severityLevel("severity").notNull(),
    evidence: jsonb("evidence").$type<EvidenceItem[]>().notNull(),
    recommendedAction: text("recommended_action").notNull(),
    drugstoreId: integer("drugstore_id").references(() => drugstores.id),
    productId: integer("product_id").references(() => products.id),
    batchId: integer("batch_id").references(() => batches.id),
    assignedTo: uuid("assigned_to").references(() => users.id),
    dueDate: date("due_date"),
    status: alertStatus("status").notNull().default("new"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...lineage(),
    createdAt: createdAt(),
  },
  (t) => [index("alerts_status_idx").on(t.status, t.severity), index("alerts_drugstore_idx").on(t.drugstoreId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    alertId: integer("alert_id").references(() => alerts.id),
    assignedTo: uuid("assigned_to").references(() => users.id),
    dueDate: date("due_date"),
    status: taskStatus("status").notNull().default("open"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_assignee_idx").on(t.assignedTo, t.status)],
);

export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    entityType: varchar("entity_type", { length: 48 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }).notNull(),
    body: text("body").notNull(),
    authorId: uuid("author_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("notes_entity_idx").on(t.entityType, t.entityId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    action: varchar("action", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 48 }),
    entityId: varchar("entity_id", { length: 64 }),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.entityType, t.entityId), index("audit_logs_created_idx").on(t.createdAt)],
);

// ─── Computed metric snapshots (ESTIMATED; populated by later phases) ────────

export const drugstoreRelationshipMetrics = pgTable(
  "drugstore_relationship_metrics",
  {
    id: serial("id").primaryKey(),
    drugstoreId: integer("drugstore_id")
      .notNull()
      .references(() => drugstores.id),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull(),
    ...lineage(),
  },
  (t) => [index("drm_drugstore_idx").on(t.drugstoreId, t.computedAt)],
);

export const productDrugstoreMetrics = pgTable(
  "product_drugstore_metrics",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    drugstoreId: integer("drugstore_id")
      .notNull()
      .references(() => drugstores.id),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull(),
    ...lineage(),
  },
  (t) => [index("pdm_pair_idx").on(t.productId, t.drugstoreId, t.computedAt)],
);

export const riskScores = pgTable(
  "risk_scores",
  {
    id: serial("id").primaryKey(),
    entityType: varchar("entity_type", { length: 32 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }).notNull(),
    scoreType: varchar("score_type", { length: 64 }).notNull(),
    score: numeric("score", { precision: 6, scale: 2, mode: "number" }),
    level: varchar("level", { length: 32 }),
    factors: jsonb("factors").$type<{ label: string; impact: number; explanation: string }[]>().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    ...lineage(),
  },
  (t) => [index("risk_scores_entity_idx").on(t.entityType, t.entityId, t.scoreType)],
);
