import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { drugstores, marketSignals, products, territories, users } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/current-user";
import { drugstoreScopeFor } from "@/lib/auth/permissions";

export const SIGNALS_PAGE_SIZE = 30;
export const signalFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

/**
 * Market signals visible to the user. Signals are REPORTED intelligence and
 * may not be tied to a drugstore, so scope falls back to territory/reporter.
 */
export async function listSignals(user: CurrentUser, page: number) {
  const scope = drugstoreScopeFor(user);
  const cond =
    scope.kind === "all"
      ? sql`true`
      : scope.kind === "territory"
        ? sql`coalesce(${drugstores.territoryId}, ${marketSignals.territoryId}) = ${scope.territoryId}`
        : scope.kind === "assigned"
          ? sql`(${drugstores.assignedRepId} = ${scope.userId} or ${marketSignals.reporterId} = ${scope.userId})`
          : // Medical reps (no drugstore scope) see signals they reported or from their territory.
            user.territoryId
            ? sql`(${marketSignals.reporterId} = ${user.id} or ${marketSignals.territoryId} = ${user.territoryId})`
            : sql`${marketSignals.reporterId} = ${user.id}`;
  const db = getDb();
  const [rows, [agg]] = await Promise.all([
    db
      .select({
        id: marketSignals.id,
        signalDate: marketSignals.signalDate,
        category: marketSignals.category,
        observation: marketSignals.observation,
        observedPrice: marketSignals.observedPrice,
        confidence: marketSignals.confidence,
        sourceType: marketSignals.sourceType,
        sourceEntity: marketSignals.sourceEntity,
        status: marketSignals.status,
        city: marketSignals.city,
        productName: products.name,
        productNameAr: products.nameAr,
        drugstoreId: drugstores.id,
        drugstoreName: drugstores.name,
        drugstoreNameAr: drugstores.nameAr,
        reporterName: users.fullName,
        reporterNameAr: users.fullNameAr,
        reporterRole: marketSignals.reporterRole,
        territoryEn: territories.nameEn,
        territoryAr: territories.nameAr,
      })
      .from(marketSignals)
      .leftJoin(drugstores, eq(drugstores.id, marketSignals.drugstoreId))
      .leftJoin(products, eq(products.id, marketSignals.productId))
      .leftJoin(users, eq(users.id, marketSignals.reporterId))
      .leftJoin(territories, eq(territories.id, marketSignals.territoryId))
      .where(cond)
      .orderBy(desc(marketSignals.signalDate), desc(marketSignals.id))
      .limit(SIGNALS_PAGE_SIZE)
      .offset((page - 1) * SIGNALS_PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(marketSignals)
      .leftJoin(drugstores, eq(drugstores.id, marketSignals.drugstoreId))
      .where(cond),
  ]);
  return { rows, total: agg?.count ?? 0 };
}

export async function listUsers() {
  return getDb()
    .select({
      id: users.id,
      fullName: users.fullName,
      fullNameAr: users.fullNameAr,
      email: users.email,
      role: users.role,
      active: users.active,
      lastLoginAt: users.lastLoginAt,
      territoryEn: territories.nameEn,
      territoryAr: territories.nameAr,
    })
    .from(users)
    .leftJoin(territories, eq(territories.id, users.territoryId))
    .orderBy(asc(users.role), asc(users.fullName));
}
