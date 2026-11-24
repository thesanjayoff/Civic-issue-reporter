import { describe, it, expect } from "vitest";
import { AUDIT_GENESIS_HASH, computeAuditHash, verifyAuditChain, type AuditRow } from "@/lib/audit/chain";

function buildChain(n: number): AuditRow[] {
  const rows: AuditRow[] = [];
  let prevHash = AUDIT_GENESIS_HASH;
  for (let i = 0; i < n; i++) {
    const entry = {
      actorType: "system" as const,
      actorId: null,
      action: "status_change",
      entityType: "report",
      entityId: `report-${i}`,
      payload: { step: i },
    };
    const hash = computeAuditHash(prevHash, entry);
    rows.push({ ...entry, seq: i + 1, prevHash, hash, createdAt: new Date().toISOString() });
    prevHash = hash;
  }
  return rows;
}

describe("audit log hash chain", () => {
  it("validates an untampered chain", () => {
    const rows = buildChain(5);
    expect(verifyAuditChain(rows).valid).toBe(true);
  });

  it("detects a mutated payload on a middle row", () => {
    const rows = buildChain(5);
    rows[2] = { ...rows[2], payload: { step: 999 } };
    const result = verifyAuditChain(rows);
    expect(result.valid).toBe(false);
    expect(result.brokenAtSeq).toBe(3);
  });

  it("detects a deleted (spliced-out) row by breaking the prevHash link", () => {
    const rows = buildChain(5);
    rows.splice(2, 1);
    const result = verifyAuditChain(rows);
    expect(result.valid).toBe(false);
  });

  it("detects a reordered chain", () => {
    const rows = buildChain(5);
    [rows[1], rows[2]] = [rows[2], rows[1]];
    const result = verifyAuditChain(rows);
    expect(result.valid).toBe(false);
  });

  it("produces different hashes for different payloads regardless of key order", () => {
    const a = computeAuditHash(AUDIT_GENESIS_HASH, {
      actorType: "system",
      action: "x",
      entityType: "report",
      payload: { a: 1, b: 2 },
    });
    const b = computeAuditHash(AUDIT_GENESIS_HASH, {
      actorType: "system",
      action: "x",
      entityType: "report",
      payload: { b: 2, a: 1 },
    });
    expect(a).toBe(b);
  });
});
