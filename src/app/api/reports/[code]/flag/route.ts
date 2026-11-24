import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getOrCreateDeviceId } from "@/lib/auth/session";
import { getReportIdByPublicCode } from "@/lib/reports/detail";
import { checkAndRecordRateLimit, RATE_LIMIT_RULES } from "@/lib/moderation/rateLimit";
import { appendAudit } from "@/lib/audit/log";

const flagInputSchema = z.object({ reason: z.string().min(5).max(1000) });

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const reportId = await getReportIdByPublicCode(code);
  if (!reportId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const deviceId = await getOrCreateDeviceId();
  const allowed = await checkAndRecordRateLimit(deviceId, RATE_LIMIT_RULES.flagModeration);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const parsed = flagInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });

  const [flag] = await db.execute<{ id: string }>(sql`
    INSERT INTO moderation_flags (report_id, flagged_by_device_id, reason) VALUES (${reportId}, ${deviceId}, ${parsed.data.reason}) RETURNING id
  `);

  await appendAudit({ actorType: "citizen", action: "report_flagged", entityType: "report", entityId: reportId, payload: { flagId: flag.id } });

  return NextResponse.json({ flagId: flag.id }, { status: 201 });
}
