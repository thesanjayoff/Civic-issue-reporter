import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

/**
 * Eager on purpose. Next.js loads .env.local before any application code
 * runs, so this is safe inside the app. Standalone scripts that import
 * anything which transitively pulls in this module must load env *before*
 * that import resolves — ESM import hoisting means a dotenv config() call
 * written earlier in the same file still runs after every static import, so
 * use `tsx --env-file=.env.local script.ts` (or migrations/seed-style
 * scripts that talk to Postgres directly without importing this module).
 */
declare global {
  // eslint-disable-next-line no-var
  var __ooruKuralSql: ReturnType<typeof postgres> | undefined;
}

function getSqlClient() {
  if (!globalThis.__ooruKuralSql) {
    globalThis.__ooruKuralSql = postgres(getEnv().DATABASE_URL, {
      max: 10,
      transform: { undefined: null },
    });
  }
  return globalThis.__ooruKuralSql;
}

export const sqlClient = getSqlClient();
export const db = drizzle(sqlClient, { schema });
export type Db = typeof db;
