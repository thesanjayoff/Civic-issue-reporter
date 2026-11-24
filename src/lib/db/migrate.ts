/**
 * Minimal, dependency-free SQL migration runner. We don't use drizzle-kit's
 * generated migrations because the PostGIS DDL (SRIDs, geometry subtypes,
 * GIST indexes, the audit-log immutability trigger) needs to be hand-written
 * and reviewed, not diffed automatically. Run with `npm run db:migrate`.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql`CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;

    const dir = join(process.cwd(), "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const already = await sql`SELECT 1 FROM _migrations WHERE name = ${file}`;
      if (already.length > 0) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }
      const contents = readFileSync(join(dir, file), "utf8");
      console.log(`apply ${file}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`INSERT INTO _migrations (name) VALUES (${file})`;
      });
    }
    console.log("Migrations complete.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
