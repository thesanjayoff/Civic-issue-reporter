import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getOrCreateDeviceId } from "@/lib/auth/session";
import { getReportByPublicCode } from "@/lib/reports/detail";
import { buildEscalationMessage, type EscalationStepKind } from "@/lib/escalation/templates";
import { checkAndRecordRateLimit, RATE_LIMIT_RULES } from "@/lib/moderation/rateLimit";
import { appendAudit } from "@/lib/audit/log";

const STEPS: EscalationStepKind[] = ["reminder", "zonal", "regional", "state_grievance", "central_grievance", "rti"];

/** Builds the ready-to-send bilingual escalation message for a step — a human still copies/sends it themselves; this app never auto-submits to any channel. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { searchParams } = new URL(req.url);
  const step = searchParams.get("step") as EscalationStepKind | null;
  if (!step || !STEPS.includes(step)) {
    return NextResponse.json({ error: "invalid_step", validSteps: STEPS }, { status: 400 });
  }

  const report = await getReportByPublicCode(code);
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const overdueDays = report.slaDeadline ? Math.max(0, (Date.now() - new Date(report.slaDeadline).getTime()) / 86_400_000) : null;
  const evidenceUrl = new URL(`/en/track/${report.publicCode}`, req.url).toString();

  const message = buildEscalationMessage(step, {
    publicCode: report.publicCode,
    categoryLabelEn: report.categoryNameEn,
    categoryLabelTa: report.categoryNameTa,
    locationText: report.landmarkText ?? report.wardNameEn ?? "reported location",
    agencyNameEn: report.agencyNameEn ?? "the responsible agency (not yet determined)",
    agencyNameTa: report.agencyNameTa ?? "பொறுப்பான நிறுவனம் (இன்னும் தீர்மானிக்கப்படவில்லை)",
    officialReferenceNumber: report.officialReferenceNumber,
    filedDate: report.officialFiledAt,
    overdueDays,
    evidenceUrl,
  });

  return NextResponse.json({ message });
}

const escalateSendSchema = z.object({
  step: z.enum(["reminder", "zonal", "regional", "state_grievance", "central_grievance", "rti"]),
  sentVia: z.enum(["copied", "shared"]),
});

/** Records that a human actually sent this step's message (does not send anything itself). */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const reportRows = await db.execute<{ id: string }>(sql`SELECT id FROM reports WHERE public_code = ${code} AND deleted_at IS NULL LIMIT 1`);
  const reportId = reportRows[0]?.id;
  if (!reportId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const deviceId = await getOrCreateDeviceId();
  const allowed = await checkAndRecordRateLimit(deviceId, RATE_LIMIT_RULES.escalationSend);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const parsed = escalateSendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });

  const stepIndex = STEPS.indexOf(parsed.data.step);

  await db.execute(sql`
    INSERT INTO escalation_sends (report_id, ladder_step, template_key, sent_via, sent_by_device_id)
    VALUES (${reportId}, ${stepIndex}, ${parsed.data.step}, ${parsed.data.sentVia}, ${deviceId})
  `);
  await db.execute(sql`UPDATE reports SET status = 'escalated' WHERE id = ${reportId} AND status NOT IN ('closed', 'verified_fixed')`);
  await db.execute(sql`
    INSERT INTO timeline_events (report_id, type, actor_type, payload)
    VALUES (${reportId}, 'escalated', 'citizen', ${JSON.stringify({ step: parsed.data.step, sentVia: parsed.data.sentVia })})
  `);

  await appendAudit({
    actorType: "citizen",
    action: "escalation_sent",
    entityType: "report",
    entityId: reportId,
    payload: { step: parsed.data.step, sentVia: parsed.data.sentVia },
  });

  return NextResponse.json({ ok: true });
}
