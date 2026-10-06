import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { batches, drugstores, products, returnItems, returns, salesInvoiceItems, salesInvoices, skus } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/current-user";
import { addDays } from "@/lib/domain/dates";
import { drugstoreScopeSql } from "../scope";

export const productFiltersSchema = z.object({
  q: z.string().trim().max(64).optional().catch(undefined),
  area: z.string().trim().max(64).optional().catch(undefined),
});
export type ProductFilters = z.infer<typeof productFiltersSchema>;

const n = (expr: SQL) => sql<number>`coalesce(${expr}, 0)`.mapWith(Number);

/**
 * Product list. Sales figures are restricted to drugstores in the user's
 * scope; batch/expiry facts are Office-wide.
 */
export async function listProducts(user: CurrentUser, f: ProductFilters, today: string) {
  const db = getDb();
  const conds: SQL[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(or(ilike(products.name, like), ilike(products.genericName, like), ilike(products.code, like))!);
  }
  if (f.area) conds.push(eq(products.therapeuticArea, f.area));
  const yearAgo = addDays(today, -365);
  const d90 = addDays(today, -90);

  const scopedSales = db
    .select({
      productId: skus.productId,
      sales12: n(sql`sum(${salesInvoiceItems.netAmount}) filter (where ${salesInvoices.invoiceDate} >= ${yearAgo})`).as("sales12"),
      sales90: n(sql`sum(${salesInvoiceItems.netAmount}) filter (where ${salesInvoices.invoiceDate} >= ${d90})`).as("sales90"),
      buyers: n(sql`count(distinct ${salesInvoices.drugstoreId}) filter (where ${salesInvoices.invoiceDate} >= ${yearAgo})`).as("buyers"),
      lastSale: sql<string | null>`max(${salesInvoices.invoiceDate})`.as("last_sale"),
    })
    .from(salesInvoiceItems)
    .innerJoin(salesInvoices, eq(salesInvoices.id, salesInvoiceItems.invoiceId))
    .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
    .innerJoin(skus, eq(skus.id, salesInvoiceItems.skuId))
    .where(drugstoreScopeSql(user))
    .groupBy(skus.productId)
    .as("scoped_sales");

  const nearestExpiry = sql<string | null>`(select min(${batches.expiryDate}) from ${batches} inner join ${skus} on ${skus.id} = ${batches.skuId} where ${skus.productId} = ${products.id} and ${batches.expiryDate} >= ${today})`;

  const [rows, areas] = await Promise.all([
    db
      .select({
        id: products.id,
        code: products.code,
        name: products.name,
        nameAr: products.nameAr,
        genericName: products.genericName,
        therapeuticArea: products.therapeuticArea,
        isStrategic: products.isStrategic,
        sales12: sql<number>`coalesce(${scopedSales.sales12}, 0)`.mapWith(Number),
        sales90: sql<number>`coalesce(${scopedSales.sales90}, 0)`.mapWith(Number),
        buyers: sql<number>`coalesce(${scopedSales.buyers}, 0)`.mapWith(Number),
        lastSale: scopedSales.lastSale,
        nearestExpiry,
      })
      .from(products)
      .leftJoin(scopedSales, eq(scopedSales.productId, products.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(sql`coalesce(${scopedSales.sales12}, 0) desc`, asc(products.name)),
    db
      .selectDistinct({ area: products.therapeuticArea })
      .from(products)
      .orderBy(asc(products.therapeuticArea)),
  ]);
  return { rows, areas: areas.map((a) => a.area).filter((a): a is string => Boolean(a)) };
}

export async function getProduct(user: CurrentUser, id: number, today: string) {
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return null;
  const yearAgo = addDays(today, -365);
  const scope = drugstoreScopeSql(user);

  const [skuRows, batchRows, purchasers, monthly, [ret]] = await Promise.all([
    db.select().from(skus).where(eq(skus.productId, id)).orderBy(asc(skus.code)),
    db
      .select({
        id: batches.id,
        batchNumber: batches.batchNumber,
        skuCode: skus.code,
        productionDate: batches.productionDate,
        expiryDate: batches.expiryDate,
        receivedDate: batches.receivedDate,
        quantityReceived: batches.quantityReceived,
        // Office-wide delivered quantity (not scoped): the batch is an Office asset.
        delivered: n(
          sql`(select sum(${salesInvoiceItems.quantity} + ${salesInvoiceItems.bonusQuantity}) from ${salesInvoiceItems} where ${salesInvoiceItems.batchId} = ${batches.id})`,
        ),
        drugstoreCount: n(
          sql`(select count(distinct ${salesInvoices.drugstoreId}) from ${salesInvoiceItems} inner join ${salesInvoices} on ${salesInvoices.id} = ${salesInvoiceItems.invoiceId} where ${salesInvoiceItems.batchId} = ${batches.id})`,
        ),
      })
      .from(batches)
      .innerJoin(skus, eq(skus.id, batches.skuId))
      .where(eq(skus.productId, id))
      .orderBy(asc(batches.expiryDate)),
    db
      .select({
        drugstoreId: drugstores.id,
        name: drugstores.name,
        nameAr: drugstores.nameAr,
        units: n(sql`sum(${salesInvoiceItems.quantity} + ${salesInvoiceItems.bonusQuantity})`),
        value: n(sql`sum(${salesInvoiceItems.netAmount})`),
        lastPurchase: sql<string | null>`max(${salesInvoices.invoiceDate})`,
        orders: n(sql`count(distinct ${salesInvoices.id})`),
      })
      .from(salesInvoiceItems)
      .innerJoin(salesInvoices, eq(salesInvoices.id, salesInvoiceItems.invoiceId))
      .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
      .innerJoin(skus, eq(skus.id, salesInvoiceItems.skuId))
      .where(and(eq(skus.productId, id), scope, sql`${salesInvoices.invoiceDate} >= ${yearAgo}`))
      .groupBy(drugstores.id)
      .orderBy(desc(sql`sum(${salesInvoiceItems.netAmount})`)),
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${salesInvoices.invoiceDate}), 'YYYY-MM-01')`,
        value: n(sql`sum(${salesInvoiceItems.netAmount})`),
      })
      .from(salesInvoiceItems)
      .innerJoin(salesInvoices, eq(salesInvoices.id, salesInvoiceItems.invoiceId))
      .innerJoin(drugstores, eq(drugstores.id, salesInvoices.drugstoreId))
      .innerJoin(skus, eq(skus.id, salesInvoiceItems.skuId))
      .where(and(eq(skus.productId, id), scope, sql`${salesInvoices.invoiceDate} >= ${yearAgo}`))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ units: n(sql`sum(${returnItems.quantity})`), value: n(sql`sum(${returnItems.value})`) })
      .from(returnItems)
      .innerJoin(returns, eq(returns.id, returnItems.returnId))
      .innerJoin(drugstores, eq(drugstores.id, returns.drugstoreId))
      .innerJoin(skus, eq(skus.id, returnItems.skuId))
      .where(and(eq(skus.productId, id), scope, sql`${returns.returnDate} >= ${yearAgo}`)),
  ]);
  return { product, skus: skuRows, batches: batchRows, purchasers, monthly, returns12m: ret ?? { units: 0, value: 0 } };
}
