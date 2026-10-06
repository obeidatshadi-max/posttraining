/**
 * Resets the database content and loads the fictional demo dataset.
 * Usage: npm run db:seed            (refuses when NODE_ENV=production)
 *        npm run db:seed -- --force (override; destroys existing data)
 */
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../schema";
import { loadScriptEnv } from "../env";
import { todayISO } from "@/lib/domain/dates";
import { DEMO_PASSWORD } from "./catalog";
import { generateDemoData } from "./generate";

const TABLES = [
  "audit_logs", "notes", "tasks", "alerts", "risk_scores", "product_drugstore_metrics",
  "drugstore_relationship_metrics", "market_prices", "market_signals", "return_items", "returns",
  "collections", "payment_allocations", "payments", "sales_targets", "sales_invoice_items",
  "sales_invoices", "imports", "data_sources", "offer_items", "commercial_offers", "batches", "skus",
  "products", "competitors", "pharmacies", "credit_limits", "drugstores", "users", "territories",
];

async function insertChunked<T extends Record<string, unknown>>(
  db: ReturnType<typeof drizzle<typeof schema>>,
  table: Parameters<ReturnType<typeof drizzle<typeof schema>>["insert"]>[0],
  rows: T[],
  size = 500,
) {
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + size) as any);
  }
}

async function main() {
  const force = process.argv.includes("--force");
  if (process.env.NODE_ENV === "production" && !force) {
    throw new Error("Refusing to seed demo data with NODE_ENV=production. Pass --force to override.");
  }
  const pool = new Pool({ connectionString: loadScriptEnv() });
  const db = drizzle(pool, { schema });
  const today = process.env.SEED_TODAY ?? todayISO();
  const data = generateDemoData(today);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`));
      const t = tx as unknown as ReturnType<typeof drizzle<typeof schema>>;
      await insertChunked(t, schema.territories, data.territories);
      await insertChunked(t, schema.users, data.users.map((u) => ({ ...u, passwordHash })));
      await insertChunked(t, schema.drugstores, data.drugstores);
      await insertChunked(t, schema.creditLimits, data.creditLimits);
      await insertChunked(t, schema.pharmacies, data.pharmacies);
      await insertChunked(t, schema.competitors, data.competitors);
      await insertChunked(t, schema.products, data.products);
      await insertChunked(t, schema.skus, data.skus);
      await insertChunked(t, schema.batches, data.batches);
      await insertChunked(t, schema.commercialOffers, data.offers);
      await insertChunked(t, schema.offerItems, data.offerItems);
      await insertChunked(t, schema.dataSources, data.dataSources);
      await insertChunked(t, schema.salesInvoices, data.invoices);
      await insertChunked(t, schema.salesInvoiceItems, data.invoiceItems);
      await insertChunked(t, schema.payments, data.payments);
      await insertChunked(t, schema.paymentAllocations, data.allocations);
      await insertChunked(t, schema.returns, data.returns);
      await insertChunked(t, schema.returnItems, data.returnItems);
      await insertChunked(t, schema.salesTargets, data.salesTargets);
      await insertChunked(t, schema.marketSignals, data.marketSignals);
      await insertChunked(t, schema.marketPrices, data.marketPrices);

      // Explicit ids were inserted; move every serial sequence past them.
      const serialTables = TABLES.filter((name) => name !== "users");
      for (const name of serialTables) {
        await tx.execute(
          sql.raw(
            `SELECT setval(pg_get_serial_sequence('${name}', 'id'), COALESCE((SELECT MAX(id) FROM ${name}), 0) + 1, false)`,
          ),
        );
      }
    });
    console.log(
      `✓ Seeded demo data as of ${today}: ${data.drugstores.length} drugstores, ${data.products.length} products, ` +
        `${data.batches.length} batches, ${data.invoices.length} invoices, ${data.payments.length} payments, ` +
        `${data.returns.length} returns, ${data.marketSignals.length} market signals.`,
    );
    console.log(`  Demo accounts use password: ${DEMO_PASSWORD}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
