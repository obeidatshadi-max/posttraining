import "server-only";
import { eq, sql, type SQL } from "drizzle-orm";
import { drugstores } from "@/db/schema";
import { drugstoreScopeFor } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";

/**
 * SQL predicate restricting rows to drugstores the user may see.
 * Every query that touches drugstore-linked data must AND this in.
 */
export function drugstoreScopeSql(user: CurrentUser): SQL {
  const scope = drugstoreScopeFor(user);
  switch (scope.kind) {
    case "all":
      return sql`true`;
    case "territory":
      return eq(drugstores.territoryId, scope.territoryId);
    case "assigned":
      return eq(drugstores.assignedRepId, scope.userId);
    case "none":
      return sql`false`;
  }
}

/** Territory id used for target lookup (null = all territories, undefined = no target applies). */
export function targetTerritoryFor(user: CurrentUser): number | null | undefined {
  const scope = drugstoreScopeFor(user);
  if (scope.kind === "all") return null;
  if (scope.kind === "territory") return scope.territoryId;
  return undefined;
}
