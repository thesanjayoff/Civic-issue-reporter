import { NextResponse } from "next/server";
import { loadAuditChain, verifyAuditChain } from "@/lib/audit/log";

/** Transparency/admin endpoint: re-verifies the whole hash chain on demand. Read-only, no auth gate yet — see README limitations (admin auth is not built). */
export async function GET() {
  const rows = await loadAuditChain();
  const result = verifyAuditChain(rows);
  return NextResponse.json(result);
}
