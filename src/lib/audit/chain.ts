import { createHash } from "crypto";

export const AUDIT_GENESIS_HASH = "0".repeat(64);

export interface AuditEntryInput {
  actorType: "citizen" | "volunteer" | "authority" | "system" | "moderator";
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload: Record<string, unknown>;
}

export interface AuditRow extends AuditEntryInput {
  seq: number;
  prevHash: string;
  hash: string;
  createdAt: string;
}

/** Deterministic JSON stringify (sorted keys) so hashing doesn't depend on key insertion order. */
export function canonicalJson(value: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, val]) => [k, sortKeys(val)])
      );
    }
    return v;
  };
  return JSON.stringify(sortKeys(value));
}

export function computeAuditHash(prevHash: string, entry: AuditEntryInput): string {
  const canonical = canonicalJson({
    prevHash,
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    payload: entry.payload,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export interface ChainVerificationResult {
  valid: boolean;
  brokenAtSeq: number | null;
  checkedRows: number;
}

/** Pure verification over an in-order row list — used by tests and an admin "verify audit log" action. */
export function verifyAuditChain(rows: AuditRow[]): ChainVerificationResult {
  let prevHash = AUDIT_GENESIS_HASH;
  for (const row of rows) {
    if (row.prevHash !== prevHash) {
      return { valid: false, brokenAtSeq: row.seq, checkedRows: rows.length };
    }
    const expectedHash = computeAuditHash(prevHash, row);
    if (expectedHash !== row.hash) {
      return { valid: false, brokenAtSeq: row.seq, checkedRows: rows.length };
    }
    prevHash = row.hash;
  }
  return { valid: true, brokenAtSeq: null, checkedRows: rows.length };
}
