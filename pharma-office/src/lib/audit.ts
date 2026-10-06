import "server-only";
import { getDb, type Database } from "@/db/client";
import { auditLogs } from "@/db/schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function writeAudit(
  entry: {
    userId: string | null;
    action: string;
    entityType?: string;
    entityId?: string | number;
    details?: Record<string, unknown>;
  },
  tx?: Tx,
): Promise<void> {
  await (tx ?? getDb()).insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId === undefined ? undefined : String(entry.entityId),
    details: entry.details,
  });
}
