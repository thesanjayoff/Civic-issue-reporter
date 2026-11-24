import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

/** Moderation queue listing. No auth gate yet — intended for a moderator-only area; see README limitations. */
export async function GET() {
  const rows = await db.execute<{
    id: string;
    report_id: string;
    public_code: string;
    reason: string;
    status: string;
    created_at: string;
  }>(sql`
    SELECT mf.id, mf.report_id, r.public_code, mf.reason, mf.status, mf.created_at
    FROM moderation_flags mf
    JOIN reports r ON r.id = mf.report_id
    WHERE mf.status = 'pending'
    ORDER BY mf.created_at ASC
  `);
  return NextResponse.json({
    flags: rows.map((r) => ({ id: r.id, reportId: r.report_id, publicCode: r.public_code, reason: r.reason, status: r.status, createdAt: r.created_at })),
  });
}
