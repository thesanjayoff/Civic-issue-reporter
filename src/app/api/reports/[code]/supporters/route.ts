import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getOrCreateDeviceId } from "@/lib/auth/session";
import { getReportIdByPublicCode } from "@/lib/reports/detail";
import { checkAndRecordRateLimit, RATE_LIMIT_RULES } from "@/lib/moderation/rateLimit";
import { appendAudit } from "@/lib/audit/log";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const reportId = await getReportIdByPublicCode(code);
  if (!reportId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const deviceId = await getOrCreateDeviceId();
  const allowed = await checkAndRecordRateLimit(deviceId, RATE_LIMIT_RULES.addSupporter);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const inserted = await db.execute<{ id: string }>(sql`
    INSERT INTO report_supporters (report_id, device_id) VALUES (${reportId}, ${deviceId})
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  if (inserted.length > 0) {
    await db.execute(sql`UPDATE reports SET supporter_count = supporter_count + 1 WHERE id = ${reportId}`);
    await appendAudit({ actorType: "citizen", action: "supporter_added", entityType: "report", entityId: reportId, payload: {} });
  }

  const [{ supporter_count }] = await db.execute<{ supporter_count: number }>(sql`SELECT supporter_count FROM reports WHERE id = ${reportId}`);
  return NextResponse.json({ supporterCount: Number(supporter_count), alreadySupported: inserted.length === 0 });
}
