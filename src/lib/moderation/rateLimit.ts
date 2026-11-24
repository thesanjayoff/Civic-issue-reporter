import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { isWithinLimit, type RateLimitRule } from "./rateLimitRules";

export * from "./rateLimitRules";

/**
 * Checks + records in one call: counts events for `identity` (a hashed
 * device id or IP) in the trailing window, and if still under the limit,
 * records this attempt too. Returns whether the action is allowed.
 */
export async function checkAndRecordRateLimit(identity: string, rule: RateLimitRule): Promise<boolean> {
  const windowStart = sql`now() - interval '${sql.raw(String(rule.windowMinutes))} minutes'`;
  const rows = await db.execute<{ count: string }>(sql`
    SELECT count(*) FROM rate_limit_events
    WHERE identity = ${identity} AND action = ${rule.action} AND created_at > ${windowStart}
  `);
  const count = Number(rows[0]?.count ?? 0);
  if (!isWithinLimit(count, rule)) return false;

  await db.execute(sql`INSERT INTO rate_limit_events (identity, action) VALUES (${identity}, ${rule.action})`);
  return true;
}
