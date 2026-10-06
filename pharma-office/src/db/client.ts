import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __pharmaDb?: Database; __pharmaPool?: Pool };

/**
 * Lazily creates the database client so that importing this module never
 * requires DATABASE_URL (e.g. during `next build` of static shells).
 */
export function getDb(): Database {
  if (globalForDb.__pharmaDb) return globalForDb.__pharmaDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and configure PostgreSQL.");
  }
  const pool = new Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  globalForDb.__pharmaPool = pool;
  globalForDb.__pharmaDb = db;
  return db;
}
