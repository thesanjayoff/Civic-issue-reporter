import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getReportIdByPublicCode } from "@/lib/reports/detail";
import { computeSlaDeadline } from "@/lib/sla/clock";
import { appendAudit } from "@/lib/audit/log";

/**
 * Records that a report was officially filed with an authority (reference
 * number logged by a citizen/volunteer after they submitted it through the
 * authority's own channel — this app never auto-submits on anyone's behalf).
 * This is what starts the SLA clock, per computeSlaDeadline's contract.
 */
const fileInputSchema = z.object({
  officialReferenceNumber: z.string().min(1).max(80),
  officialFiledAt: z.string().datetime().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const reportId = await getReportIdByPublicCode(code);
  if (!reportId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = fileInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });

  const filedAt = parsed.data.officialFiledAt ? new Date(parsed.data.officialFiledAt) : new Date();

  const slaRows = await db.execute<{ target_hours: number; is_published: boolean; source_label: string }>(sql`
    SELECT st.target_hours, st.is_published, st.source_label
    FROM reports r
    JOIN sla_targets st ON st.category_id = r.category_id AND (st.agency_id = r.agency_id OR st.agency_id IS NULL)
    WHERE r.id = ${reportId}
    ORDER BY st.agency_id NULLS LAST
    LIMIT 1
  `);

  let slaDeadline: Date | null = null;
  if (slaRows[0]) {
    slaDeadline = computeSlaDeadline(filedAt, {
      targetHours: slaRows[0].target_hours,
      isPublished: slaRows[0].is_published,
      sourceLabel: slaRows[0].source_label,
    });
  }

  await db.execute(sql`
    UPDATE reports
    SET official_reference_number = ${parsed.data.officialReferenceNumber},
        official_filed_at = ${filedAt.toISOString()},
        sla_deadline = ${slaDeadline ? slaDeadline.toISOString() : null},
        status = 'filed'
    WHERE id = ${reportId}
  `);

  await db.execute(sql`
    INSERT INTO timeline_events (report_id, type, actor_type, payload)
    VALUES (${reportId}, 'filed', 'citizen', ${JSON.stringify({ officialReferenceNumber: parsed.data.officialReferenceNumber })})
  `);

  await appendAudit({
    actorType: "citizen",
    action: "report_filed",
    entityType: "report",
    entityId: reportId,
    payload: { officialReferenceNumber: parsed.data.officialReferenceNumber },
  });

  return NextResponse.json({ slaDeadline: slaDeadline?.toISOString() ?? null, slaIsPublished: slaRows[0]?.is_published ?? false });
}
