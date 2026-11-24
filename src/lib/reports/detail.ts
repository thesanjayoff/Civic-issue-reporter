import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export interface ReportDetail {
  id: string;
  publicCode: string;
  status: string;
  categorySlug: string;
  categoryNameEn: string;
  categoryNameTa: string;
  descriptionEn: string | null;
  descriptionTa: string | null;
  landmarkText: string | null;
  lon: number;
  lat: number;
  isSensitive: boolean;
  wardNameEn: string | null;
  wardNameTa: string | null;
  agencySlug: string | null;
  agencyNameEn: string | null;
  agencyNameTa: string | null;
  routingStatus: string;
  routingConfidence: number | null;
  officialReferenceNumber: string | null;
  officialFiledAt: string | null;
  slaDeadline: string | null;
  supporterCount: number;
  createdAt: string;
}

export async function getReportByPublicCode(publicCode: string): Promise<ReportDetail | null> {
  const rows = await db.execute<{
    id: string;
    public_code: string;
    status: string;
    category_slug: string;
    category_name_en: string;
    category_name_ta: string;
    description_en: string | null;
    description_ta: string | null;
    landmark_text: string | null;
    lon: number;
    lat: number;
    is_sensitive: boolean;
    ward_name_en: string | null;
    ward_name_ta: string | null;
    agency_slug: string | null;
    agency_name_en: string | null;
    agency_name_ta: string | null;
    routing_status: string;
    routing_confidence: number | null;
    official_reference_number: string | null;
    official_filed_at: string | null;
    sla_deadline: string | null;
    supporter_count: number;
    created_at: string;
  }>(sql`
    SELECT r.id, r.public_code, r.status, c.slug AS category_slug, c.name_en AS category_name_en, c.name_ta AS category_name_ta,
           r.description_en, r.description_ta, r.landmark_text,
           ST_X(COALESCE(r.display_geom, r.geom)) AS lon, ST_Y(COALESCE(r.display_geom, r.geom)) AS lat,
           r.is_sensitive, w.name_en AS ward_name_en, w.name_ta AS ward_name_ta,
           a.slug AS agency_slug, a.name_en AS agency_name_en, a.name_ta AS agency_name_ta,
           r.routing_status, r.routing_confidence, r.official_reference_number, r.official_filed_at,
           r.sla_deadline, r.supporter_count, r.created_at
    FROM reports r
    JOIN categories c ON c.id = r.category_id
    LEFT JOIN wards w ON w.id = r.ward_id
    LEFT JOIN agencies a ON a.id = r.agency_id
    WHERE r.public_code = ${publicCode} AND r.deleted_at IS NULL
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    publicCode: row.public_code,
    status: row.status,
    categorySlug: row.category_slug,
    categoryNameEn: row.category_name_en,
    categoryNameTa: row.category_name_ta,
    descriptionEn: row.description_en,
    descriptionTa: row.description_ta,
    landmarkText: row.landmark_text,
    lon: Number(row.lon),
    lat: Number(row.lat),
    isSensitive: row.is_sensitive,
    wardNameEn: row.ward_name_en,
    wardNameTa: row.ward_name_ta,
    agencySlug: row.agency_slug,
    agencyNameEn: row.agency_name_en,
    agencyNameTa: row.agency_name_ta,
    routingStatus: row.routing_status,
    routingConfidence: row.routing_confidence !== null ? Number(row.routing_confidence) : null,
    officialReferenceNumber: row.official_reference_number,
    officialFiledAt: row.official_filed_at,
    slaDeadline: row.sla_deadline,
    supporterCount: Number(row.supporter_count),
    createdAt: row.created_at,
  };
}

export interface TimelineEventDto {
  id: string;
  type: string;
  actorType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function getTimelineForReport(reportId: string): Promise<TimelineEventDto[]> {
  const rows = await db.execute<{ id: string; type: string; actor_type: string; payload: Record<string, unknown>; created_at: string }>(sql`
    SELECT id, type, actor_type, payload, created_at FROM timeline_events WHERE report_id = ${reportId} ORDER BY created_at ASC
  `);
  return rows.map((r) => ({ id: r.id, type: r.type, actorType: r.actor_type, payload: r.payload, createdAt: r.created_at }));
}

export interface PhotoDto {
  id: string;
  kind: string;
  storageKey: string;
  capturedAt: string | null;
  blurApplied: boolean;
  exifStripped: boolean;
}

export async function getPhotosForReport(reportId: string): Promise<PhotoDto[]> {
  const rows = await db.execute<{
    id: string;
    kind: string;
    storage_key: string;
    captured_at: string | null;
    blur_applied: boolean;
    exif_stripped: boolean;
  }>(sql`
    SELECT id, kind, storage_key, captured_at, blur_applied, exif_stripped FROM report_photos WHERE report_id = ${reportId} ORDER BY created_at ASC
  `);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    storageKey: r.storage_key,
    capturedAt: r.captured_at,
    blurApplied: r.blur_applied,
    exifStripped: r.exif_stripped,
  }));
}

export async function getReportIdByPublicCode(publicCode: string): Promise<string | null> {
  const rows = await db.execute<{ id: string }>(sql`SELECT id FROM reports WHERE public_code = ${publicCode} AND deleted_at IS NULL LIMIT 1`);
  return rows[0]?.id ?? null;
}

export interface VerificationAttemptDto {
  id: string;
  outcome: string;
  mismatchFlagged: boolean;
  mismatchReason: string | null;
  createdAt: string;
}

export async function getVerificationAttemptsForReport(reportId: string): Promise<VerificationAttemptDto[]> {
  const rows = await db.execute<{ id: string; outcome: string; mismatch_flagged: boolean; mismatch_reason: string | null; created_at: string }>(sql`
    SELECT id, outcome, mismatch_flagged, mismatch_reason, created_at FROM verification_attempts WHERE report_id = ${reportId} ORDER BY created_at ASC
  `);
  return rows.map((r) => ({ id: r.id, outcome: r.outcome, mismatchFlagged: r.mismatch_flagged, mismatchReason: r.mismatch_reason, createdAt: r.created_at }));
}
