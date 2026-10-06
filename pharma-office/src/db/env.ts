/** Loads .env.local / .env for CLI scripts (Next.js loads these itself at runtime). */
import { existsSync } from "node:fs";

export function loadScriptEnv() {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }
  return process.env.DATABASE_URL;
}
