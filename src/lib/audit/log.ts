import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { AUDIT_GENESIS_HASH, computeAuditHash, type AuditEntryInput, type AuditRow } from "./chain";

export * from "./chain";

/**
 * Appends one audit event under `pg_advisory_xact_lock` so concurrent writers
 * can't both read the same "last hash" and fork the chain. Call this from
 * every status/moderation mutation instead of writing to audit_log directly.
 */
export async function appendAudit(entry: AuditEntryInput): Promise<AuditRow> {
  return db.transaction(async (tx) => {
    // Fixed arbitrary lock key scoped to this table — serializes audit writes only.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(727271)`);

    const last = await tx.execute<{ hash: string }>(
      sql`SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1`
    );
    const prevHash = last[0]?.hash ?? AUDIT_GENESIS_HASH;
    const hash = computeAuditHash(prevHash, entry);

    const inserted = await tx.execute<{
      seq: number;
      created_at: string;
    }>(sql`
      INSERT INTO audit_log (prev_hash, hash, actor_type, actor_id, action, entity_type, entity_id, payload)
      VALUES (${prevHash}, ${hash}, ${entry.actorType}, ${entry.actorId ?? null}, ${entry.action},
              ${entry.entityType}, ${entry.entityId ?? null}, ${JSON.stringify(entry.payload)})
      RETURNING seq, created_at
    `);

    return {
      ...entry,
      seq: inserted[0].seq,
      prevHash,
      hash,
      createdAt: inserted[0].created_at,
    };
  });
}

export async function loadAuditChain(limit = 10000): Promise<AuditRow[]> {
  const rows = await db.execute<{
    seq: number;
    prev_hash: string;
    hash: string;
    actor_type: AuditEntryInput["actorType"];
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
  }>(sql`SELECT * FROM audit_log ORDER BY seq ASC LIMIT ${limit}`);

  return rows.map((r) => ({
    seq: r.seq,
    prevHash: r.prev_hash,
    hash: r.hash,
    actorType: r.actor_type,
    actorId: r.actor_id,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    payload: r.payload,
    createdAt: r.created_at,
  }));
}
