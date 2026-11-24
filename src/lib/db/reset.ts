/**
 * Drops and recreates the public schema, then re-runs migrations. For local
 * dev/demo use only — never point this at anything you care about.
 */
import postgres from "postgres";
import { config } from "dotenv";
import { runMigrations } from "./migrate";

config({ path: ".env.local" });
config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const sql = postgres(databaseUrl, { max: 1 });
  console.log("Dropping and recreating public schema...");
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql.end();

  await runMigrations(databaseUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
