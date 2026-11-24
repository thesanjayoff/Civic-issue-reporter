import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

/**
 * Ward accountability metrics, normalized per 1,000 residents rather than as
 * raw counts (a bigger ward will always have more raw reports — comparing
 * raw counts across wards would be misleading). Every metric below is a
 * methodology caveat waiting to happen, so the API response always carries
 * `methodologyNotes` and the UI must show them, not just the numbers.
 */
export interface WardDashboard {
  wardId: string;
  wardNameEn: string;
  wardNameTa: string;
  populationEstimate: number | null;
  totalReports: number;
  openReports: number;
  reportsPer1000Residents: number | null;
  medianAckHours: number | null;
  medianResolutionHours: number | null;
  overdueShare: number | null;
  reopenRate: number | null;
  falseClosureRate: number | null;
  methodologyNotes: string[];
}

export async function getWardDashboard(wardId: string): Promise<WardDashboard | null> {
  const wardRows = await db.execute<{ id: string; name_en: string; name_ta: string; population_estimate: number | null }>(sql`
    SELECT id, name_en, name_ta, population_estimate FROM wards WHERE id = ${wardId} LIMIT 1
  `);
  const ward = wardRows[0];
  if (!ward) return null;

  const countRows = await db.execute<{ total: number; open: number }>(sql`
    SELECT count(*) AS total, count(*) FILTER (WHERE status NOT IN ('closed', 'verified_fixed')) AS open
    FROM reports WHERE ward_id = ${wardId} AND deleted_at IS NULL
  `);
  const totalReports = Number(countRows[0]?.total ?? 0);
  const openReports = Number(countRows[0]?.open ?? 0);

  const ackRows = await db.execute<{ median_hours: number | null }>(sql`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (te.created_at - r.created_at)) / 3600) AS median_hours
    FROM reports r
    JOIN timeline_events te ON te.report_id = r.id AND te.type = 'acknowledged'
    WHERE r.ward_id = ${wardId} AND r.deleted_at IS NULL
  `);

  const resolutionRows = await db.execute<{ median_hours: number | null }>(sql`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (te.created_at - r.created_at)) / 3600) AS median_hours
    FROM reports r
    JOIN timeline_events te ON te.report_id = r.id AND te.type IN ('resolved_by_authority', 'citizen_verified_fixed')
    WHERE r.ward_id = ${wardId} AND r.deleted_at IS NULL
  `);

  const overdueRows = await db.execute<{ overdue: number; filed: number }>(sql`
    SELECT count(*) FILTER (WHERE sla_deadline IS NOT NULL AND sla_deadline < now() AND status NOT IN ('closed', 'verified_fixed')) AS overdue,
           count(*) FILTER (WHERE sla_deadline IS NOT NULL) AS filed
    FROM reports WHERE ward_id = ${wardId} AND deleted_at IS NULL
  `);

  const reopenRows = await db.execute<{ reopened: number; verified_attempts: number }>(sql`
    SELECT
      (SELECT count(*) FROM timeline_events te JOIN reports r ON r.id = te.report_id WHERE r.ward_id = ${wardId} AND te.type = 'reopened') AS reopened,
      (SELECT count(*) FROM verification_attempts va JOIN reports r ON r.id = va.report_id WHERE r.ward_id = ${wardId}) AS verified_attempts
  `);

  const falseClosureRows = await db.execute<{ mismatches: number; total_verifications: number }>(sql`
    SELECT
      count(*) FILTER (WHERE va.mismatch_flagged) AS mismatches,
      count(*) AS total_verifications
    FROM verification_attempts va JOIN reports r ON r.id = va.report_id WHERE r.ward_id = ${wardId}
  `);

  const population = ward.population_estimate;
  const overdueFiled = Number(overdueRows[0]?.filed ?? 0);
  const reopenAttempts = Number(reopenRows[0]?.verified_attempts ?? 0);
  const verificationTotal = Number(falseClosureRows[0]?.total_verifications ?? 0);

  return {
    wardId: ward.id,
    wardNameEn: ward.name_en,
    wardNameTa: ward.name_ta,
    populationEstimate: population,
    totalReports,
    openReports,
    reportsPer1000Residents: population ? (totalReports / population) * 1000 : null,
    medianAckHours: ackRows[0]?.median_hours !== null && ackRows[0]?.median_hours !== undefined ? Number(ackRows[0].median_hours) : null,
    medianResolutionHours:
      resolutionRows[0]?.median_hours !== null && resolutionRows[0]?.median_hours !== undefined ? Number(resolutionRows[0].median_hours) : null,
    overdueShare: overdueFiled > 0 ? Number(overdueRows[0].overdue) / overdueFiled : null,
    reopenRate: reopenAttempts > 0 ? Number(reopenRows[0].reopened) / reopenAttempts : null,
    falseClosureRate: verificationTotal > 0 ? Number(falseClosureRows[0].mismatches) / verificationTotal : null,
    methodologyNotes: [
      "Population estimates are approximate and may be outdated — see each ward's recorded source and date.",
      "Report counts reflect only issues reported through this app, not the true scale of civic issues in the ward.",
      "Median ack/resolution times only cover reports that actually reached that stage; wards with many stuck/unacknowledged reports will show optimistic medians here.",
      "Overdue share only counts reports with a filed, published SLA target — reports still unfiled or routed to 'owner unknown' are excluded.",
      "Reopen rate and false-closure rate depend on citizens actually submitting closure verification — low-volume wards can show noisy percentages.",
    ],
  };
}
