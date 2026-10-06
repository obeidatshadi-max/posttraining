/**
 * Database integration tests. They run only when RUN_DB_TESTS=true and
 * DATABASE_URL points at a migrated, seeded database (CI does this).
 */
import { existsSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);
const enabled = process.env.RUN_DB_TESTS === "true" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("database integration", async () => {
  const { getDb } = await import("@/db/client");
  const schema = await import("@/db/schema");
  const { statusCondition } = await import("@/server/queries/invoices");
  const { drugstoreScopeSql } = await import("@/server/scope");
  const { PAYMENT_STATUSES, paymentStatus } = await import("@/lib/domain/payment-status");
  const db = getDb();
  const today = "2026-10-06";

  afterAll(async () => {
    const pool = (globalThis as unknown as { __pharmaPool?: { end(): Promise<void> } }).__pharmaPool;
    await pool?.end();
  });

  it("SQL status filters agree with the TypeScript status rules for every invoice", async () => {
    const invoices = await db
      .select({
        id: schema.salesInvoices.id,
        dueDate: schema.salesInvoices.dueDate,
        netAmount: schema.salesInvoices.netAmount,
        paidAmount: schema.salesInvoices.paidAmount,
        isDisputed: schema.salesInvoices.isDisputed,
      })
      .from(schema.salesInvoices);
    expect(invoices.length).toBeGreaterThan(100);
    for (const status of PAYMENT_STATUSES) {
      const rows = await db.select({ id: schema.salesInvoices.id }).from(schema.salesInvoices).where(statusCondition(status, today));
      const sqlIds = new Set(rows.map((r) => r.id));
      const tsIds = new Set(invoices.filter((i) => paymentStatus(i, today) === status).map((i) => i.id));
      expect([...sqlIds].sort(), `status ${status}`).toEqual([...tsIds].sort());
    }
  });

  it("keeps invoice paid_amount equal to the sum of its allocations", async () => {
    const mismatches = await db.execute(sql`
      select i.id from sales_invoices i
      left join (select invoice_id, sum(amount) s from payment_allocations group by invoice_id) a on a.invoice_id = i.id
      where i.paid_amount <> coalesce(a.s, 0)`);
    expect(mismatches.rows).toEqual([]);
  });

  it("scopes a sales rep to their assigned drugstores only", async () => {
    const [rep] = await db.select().from(schema.users).where(eq(schema.users.email, "rep.omar@demo.iq"));
    const user = { ...rep, role: rep.role, territoryId: rep.territoryId, financialAccess: rep.financialAccess };
    const visible = await db
      .select({ id: schema.drugstores.id, rep: schema.drugstores.assignedRepId })
      .from(schema.drugstores)
      .where(and(drugstoreScopeSql(user)));
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((d) => d.rep === rep.id)).toBe(true);
  });
});
