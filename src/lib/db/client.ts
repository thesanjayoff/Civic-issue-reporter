import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

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
