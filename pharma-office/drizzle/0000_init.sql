CREATE TYPE "public"."alert_category" AS ENUM('financial', 'commercial', 'product', 'market', 'information');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('new', 'investigating', 'actioned', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."collection_activity_type" AS ENUM('call', 'visit', 'promise_to_pay', 'dispute', 'note');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."data_source_kind" AS ENUM('manual', 'csv', 'excel', 'api', 'demo_seed');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bank_transfer', 'cheque', 'other');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('expiry', 'near_expiry', 'damaged', 'commercial', 'other');--> statement-breakpoint
CREATE TYPE "public"."severity_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."signal_category" AS ENUM('product_unavailable', 'moving_strongly', 'moving_slowly', 'low_market_price', 'high_discount_observed', 'competitor_offer', 'pharmacy_complaint', 'drugstore_supply_issue', 'availability_issue', 'unusual_movement', 'suspected_parallel_movement', 'near_expiry_concern', 'new_competitor', 'other');--> statement-breakpoint
CREATE TYPE "public"."signal_status" AS ENUM('open', 'validated', 'closed');--> statement-breakpoint
CREATE TYPE "public"."source_entity" AS ENUM('invoice', 'payment', 'return', 'credit_limit', 'offer', 'sales_rep', 'medical_rep', 'field_manager', 'manager', 'drugstore', 'pharmacy', 'market_observation', 'algorithm', 'import');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('confirmed', 'reported', 'estimated');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('director', 'sales_manager', 'area_manager', 'sales_rep', 'medical_rep', 'finance', 'admin');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedupe_key" varchar(160) NOT NULL,
	"category" "alert_category" NOT NULL,
	"alert_type" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"severity" "severity_level" NOT NULL,
	"evidence" jsonb NOT NULL,
	"recommended_action" text NOT NULL,
	"drugstore_id" integer,
	"product_id" integer,
	"batch_id" integer,
	"assigned_to" uuid,
	"due_date" date,
	"status" "alert_status" DEFAULT 'new' NOT NULL,
	"resolved_at" timestamp with time zone,
	"source_type" "source_type" NOT NULL,
	"source_entity" "source_entity" NOT NULL,
	"source_date" date NOT NULL,
	"confidence" "confidence_level" NOT NULL,
	"evidence_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alerts_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(48),
	"entity_id" varchar(64),
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku_id" integer NOT NULL,
	"batch_number" varchar(48) NOT NULL,
	"production_date" date,
	"expiry_date" date NOT NULL,
	"quantity_received" integer NOT NULL,
	"received_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"drugstore_id" integer NOT NULL,
	"user_id" uuid,
	"activity_date" date NOT NULL,
	"activity_type" "collection_activity_type" NOT NULL,
	"promised_amount" bigint,
	"promised_date" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commercial_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT 0 NOT NULL,
	"bonus_buy_qty" integer,
	"bonus_free_qty" integer,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_offers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "credit_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"drugstore_id" integer NOT NULL,
	"limit_amount" bigint NOT NULL,
	"payment_term_days" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"approved_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_limits_amount_chk" CHECK ("credit_limits"."limit_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "data_source_kind" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "drugstore_relationship_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"drugstore_id" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metrics" jsonb NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_entity" "source_entity" NOT NULL,
	"source_date" date NOT NULL,
	"confidence" "confidence_level" NOT NULL,
	"evidence_reference" text
);
--> statement-breakpoint
CREATE TABLE "drugstores" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"name_ar" text NOT NULL,
	"territory_id" integer NOT NULL,
	"city" text NOT NULL,
	"address" text,
	"contact_person" text,
	"phone" varchar(32),
	"assigned_rep_id" uuid,
	"assigned_manager_id" uuid,
	"payment_term_days" integer DEFAULT 90 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drugstores_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"data_source_id" integer,
	"entity" varchar(64) NOT NULL,
	"file_name" text,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"rows_total" integer DEFAULT 0 NOT NULL,
	"rows_ok" integer DEFAULT 0 NOT NULL,
	"rows_failed" integer DEFAULT 0 NOT NULL,
	"errors" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"observed_date" date NOT NULL,
	"product_id" integer NOT NULL,
	"sku_id" integer,
	"pharmacy_id" integer,
	"drugstore_id" integer,
	"territory_id" integer,
	"reporter_id" uuid,
	"market_price" bigint NOT NULL,
	"discount_pct" numeric(5, 2),
	"bonus_note" text,
	"source_type" "source_type" NOT NULL,
	"source_entity" "source_entity" NOT NULL,
	"source_date" date NOT NULL,
	"confidence" "confidence_level" NOT NULL,
	"evidence_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"signal_date" date NOT NULL,
	"category" "signal_category" NOT NULL,
	"reporter_id" uuid,
	"reporter_role" "user_role",
	"territory_id" integer,
	"city" text,
	"area" text,
	"product_id" integer,
	"drugstore_id" integer,
	"pharmacy_id" integer,
	"competitor_id" integer,
	"observation" text NOT NULL,
	"observed_price" bigint,
	"quantity" integer,
	"photo_url" text,
	"voice_note_url" text,
	"status" "signal_status" DEFAULT 'open' NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_entity" "source_entity" NOT NULL,
	"source_date" date NOT NULL,
	"confidence" "confidence_level" NOT NULL,
	"evidence_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(48) NOT NULL,
	"entity_id" varchar(64) NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" integer NOT NULL,
	"sku_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"invoice_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "allocations_amount_chk" CHECK ("payment_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_number" varchar(48) NOT NULL,
	"drugstore_id" integer NOT NULL,
	"payment_date" date NOT NULL,
	"amount" bigint NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text,
	"notes" text,
	"received_by" uuid,
	"import_id" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_payment_number_unique" UNIQUE("payment_number"),
	CONSTRAINT "payments_amount_chk" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "pharmacies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"territory_id" integer,
	"city" text,
	"area" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_drugstore_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"drugstore_id" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metrics" jsonb NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_entity" "source_entity" NOT NULL,
	"source_date" date NOT NULL,
	"confidence" "confidence_level" NOT NULL,
	"evidence_reference" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"generic_name" text NOT NULL,
	"strength" text,
	"dosage_form" text,
	"therapeutic_area" text,
	"is_strategic" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "return_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_id" integer NOT NULL,
	"sku_id" integer NOT NULL,
	"batch_id" integer,
	"quantity" integer NOT NULL,
	"value" bigint NOT NULL,
	"reason" "return_reason" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_number" varchar(48) NOT NULL,
	"drugstore_id" integer NOT NULL,
	"return_date" date NOT NULL,
	"reason" "return_reason" NOT NULL,
	"total_value" bigint NOT NULL,
	"credit_note_ref" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "returns_return_number_unique" UNIQUE("return_number")
);
--> statement-breakpoint
CREATE TABLE "risk_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" varchar(64) NOT NULL,
	"score_type" varchar(64) NOT NULL,
	"score" numeric(6, 2),
	"level" varchar(32),
	"factors" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_entity" "source_entity" NOT NULL,
	"source_date" date NOT NULL,
	"confidence" "confidence_level" NOT NULL,
	"evidence_reference" text
);
--> statement-breakpoint
CREATE TABLE "sales_invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"sku_id" integer NOT NULL,
	"batch_id" integer,
	"quantity" integer NOT NULL,
	"bonus_quantity" integer DEFAULT 0 NOT NULL,
	"list_price" bigint NOT NULL,
	"unit_price" bigint NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT 0 NOT NULL,
	"gross_amount" bigint NOT NULL,
	"discount_amount" bigint NOT NULL,
	"net_amount" bigint NOT NULL,
	CONSTRAINT "invoice_items_qty_chk" CHECK ("sales_invoice_items"."quantity" > 0 AND "sales_invoice_items"."bonus_quantity" >= 0),
	CONSTRAINT "invoice_items_discount_chk" CHECK ("sales_invoice_items"."discount_pct" >= 0 AND "sales_invoice_items"."discount_pct" <= 100)
);
--> statement-breakpoint
CREATE TABLE "sales_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" varchar(48) NOT NULL,
	"invoice_date" date NOT NULL,
	"drugstore_id" integer NOT NULL,
	"rep_id" uuid,
	"offer_id" integer,
	"payment_term_days" integer NOT NULL,
	"due_date" date NOT NULL,
	"gross_amount" bigint NOT NULL,
	"discount_amount" bigint NOT NULL,
	"net_amount" bigint NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"is_disputed" boolean DEFAULT false NOT NULL,
	"dispute_note" text,
	"notes" text,
	"import_id" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "invoices_amounts_chk" CHECK ("sales_invoices"."net_amount" >= 0 AND "sales_invoices"."paid_amount" >= 0 AND "sales_invoices"."paid_amount" <= "sales_invoices"."net_amount"),
	CONSTRAINT "invoices_due_chk" CHECK ("sales_invoices"."due_date" >= "sales_invoices"."invoice_date")
);
--> statement-breakpoint
CREATE TABLE "sales_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" date NOT NULL,
	"territory_id" integer,
	"target_amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skus" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"code" varchar(48) NOT NULL,
	"pack_size" text NOT NULL,
	"list_price" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skus_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"alert_id" integer,
	"assigned_to" uuid,
	"due_date" date,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territories" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(16) NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "territories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"full_name_ar" text,
	"role" "user_role" NOT NULL,
	"territory_id" integer,
	"financial_access" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_drugstore_id_drugstores_id_fk" FOREIGN KEY ("drugstore_id") REFERENCES "public"."drugstores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_drugstore_id_drugstores_id_fk" FOREIGN KEY ("drugstore_id") REFERENCES "public"."drugstores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_offers" ADD CONSTRAINT "commercial_offers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_limits" ADD CONSTRAINT "credit_limits_drugstore_id_drugstores_id_fk" FOREIGN KEY ("drugstore_id") REFERENCES "public"."drugstores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_limits" ADD CONSTRAINT "credit_limits_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drugstore_relationship_metrics" ADD CONSTRAINT "drugstore_relationship_metrics_drugstore_id_drugstores_id_fk" FOREIGN KEY ("drugstore_id") REFERENCES "public"."drugstores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drugstores" ADD CONSTRAINT "drugstores_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drugstores" ADD CONSTRAINT "drugstores_assigned_rep_id_users_id_fk" FOREIGN KEY ("assigned_rep_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drugstores" ADD CONSTRAINT "drugstores_assigned_manager_id_users_id_fk" FOREIGN KEY ("assigned_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_pharmacy_id_pharmacies_id_fk" FOREIGN KEY ("pharmacy_id") REFERENCES "public"."pharmacies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_drugstore_id_drugstores_id_fk" FOREIGN KEY ("drugstore_id") REFERENCES "public"."drugstores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_signals" ADD CONSTRAINT "market_signals_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_signals" ADD CONSTRAINT "market_signals_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_signals" ADD CONSTRAINT "market_signals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_signals" ADD CONSTRAINT "market_signals_drugstore_id_drugstores_id_fk" FOREIGN KEY ("drugstore_id") REFERENCES "public"."drugstores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_signals" ADD CONSTRAINT "market_signals_pharmacy_id_pharmacies_id_fk" FOREIGN KEY ("pharmacy_id") REFERENCES "public"."pharmacies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_signals" ADD CONSTRAINT "market_signals_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_items" ADD CONSTRAINT "offer_items_offer_id_commercial_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."commercial_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_items" ADD CONSTRAINT "offer_items_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_drugstore_id_drugstores_id_fk" FOREIGN KEY ("drugstore_id") REFERENCES "public"."drugstores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacies" ADD CONSTRAINT "pharmacies_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_drugstore_metrics" ADD CONSTRAINT "product_drugstore_metrics_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_drugstore_metrics" ADD CONSTRAINT "product_drugstore_metrics_drugstore_id_drugstores_id_fk" FOREIGN KEY ("drugstore_id") REFERENCES "public"."drugstores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_drugstore_id_drugstores_id_fk" FOREIGN KEY ("drugstore_id") REFERENCES "public"."drugstores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_drugstore_id_drugstores_id_fk" FOREIGN KEY ("drugstore_id") REFERENCES "public"."drugstores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_rep_id_users_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_offer_id_commercial_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."commercial_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skus" ADD CONSTRAINT "skus_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status","severity");--> statement-breakpoint
CREATE INDEX "alerts_drugstore_idx" ON "alerts" USING btree ("drugstore_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "batches_sku_batch_idx" ON "batches" USING btree ("sku_id","batch_number");--> statement-breakpoint
CREATE INDEX "batches_expiry_idx" ON "batches" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "collections_drugstore_idx" ON "collections" USING btree ("drugstore_id","activity_date");--> statement-breakpoint
CREATE INDEX "credit_limits_drugstore_idx" ON "credit_limits" USING btree ("drugstore_id","effective_from");--> statement-breakpoint
CREATE INDEX "drm_drugstore_idx" ON "drugstore_relationship_metrics" USING btree ("drugstore_id","computed_at");--> statement-breakpoint
CREATE INDEX "drugstores_territory_idx" ON "drugstores" USING btree ("territory_id");--> statement-breakpoint
CREATE INDEX "drugstores_rep_idx" ON "drugstores" USING btree ("assigned_rep_id");--> statement-breakpoint
CREATE INDEX "market_prices_product_idx" ON "market_prices" USING btree ("product_id","observed_date");--> statement-breakpoint
CREATE INDEX "signals_date_idx" ON "market_signals" USING btree ("signal_date");--> statement-breakpoint
CREATE INDEX "signals_product_idx" ON "market_signals" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "signals_drugstore_idx" ON "market_signals" USING btree ("drugstore_id");--> statement-breakpoint
CREATE INDEX "signals_territory_idx" ON "market_signals" USING btree ("territory_id");--> statement-breakpoint
CREATE INDEX "notes_entity_idx" ON "notes" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_items_offer_sku_idx" ON "offer_items" USING btree ("offer_id","sku_id");--> statement-breakpoint
CREATE INDEX "allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "allocations_invoice_idx" ON "payment_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_drugstore_idx" ON "payments" USING btree ("drugstore_id","payment_date");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "pharmacies_territory_idx" ON "pharmacies" USING btree ("territory_id");--> statement-breakpoint
CREATE INDEX "pdm_pair_idx" ON "product_drugstore_metrics" USING btree ("product_id","drugstore_id","computed_at");--> statement-breakpoint
CREATE INDEX "return_items_return_idx" ON "return_items" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "return_items_sku_idx" ON "return_items" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "returns_drugstore_idx" ON "returns" USING btree ("drugstore_id","return_date");--> statement-breakpoint
CREATE INDEX "risk_scores_entity_idx" ON "risk_scores" USING btree ("entity_type","entity_id","score_type");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_idx" ON "sales_invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_sku_idx" ON "sales_invoice_items" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "invoice_items_batch_idx" ON "sales_invoice_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "invoices_drugstore_idx" ON "sales_invoices" USING btree ("drugstore_id","invoice_date");--> statement-breakpoint
CREATE INDEX "invoices_date_idx" ON "sales_invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "invoices_due_idx" ON "sales_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoices_rep_idx" ON "sales_invoices" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX "invoices_open_idx" ON "sales_invoices" USING btree ("drugstore_id","due_date") WHERE "sales_invoices"."paid_amount" < "sales_invoices"."net_amount";--> statement-breakpoint
CREATE INDEX "sales_targets_month_idx" ON "sales_targets" USING btree ("month");--> statement-breakpoint
CREATE INDEX "skus_product_idx" ON "skus" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assigned_to","status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));