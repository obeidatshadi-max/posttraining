import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { loadScriptEnv } from "./env";

async function main() {
  const pool = new Pool({ connectionString: loadScriptEnv() });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("✓ Migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
