import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getOrCreateDeviceId } from "@/lib/auth/session";
import { getReportIdByPublicCode } from "@/lib/reports/detail";
import { checkClosurePhoto, outcomeReopensTimeline } from "@/lib/verification/check";
import { haversineDistanceM } from "@/lib/geo/point";
import { processPhotoForPublication, stripExif, type BlurBox } from "@/lib/privacy/image";
import { computeImageHash } from "@/lib/media/phash";
import { phashSimilarity } from "@/lib/duplicate/detect";
import { savePhotoBuffer } from "@/lib/storage/local";
import { appendAudit } from "@/lib/audit/log";

const verifyInputSchema = z.object({
  outcome: z.enum(["verified_fixed", "partially_fixed", "not_fixed_disputed", "cannot_verify"]),
  photo: z
    .object({
      dataBase64: z.string().min(1),
      gpsLat: z.number().min(-90).max(90).optional(),
      gpsLng: z.number().min(-180).max(180).optional(),
      gpsAccuracyM: z.number().min(0).max(10000).optional(),
      blurBoxes: z.array(z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })).max(20).optional(),
    })
    .optional(),
  note: z.string().max(1000).optional(),
});

const MAX_VERIFICATION_RADIUS_M = 30;

function decodeBase64Image(dataBase64: string): Buffer {
  const base64 = dataBase64.includes(",") ? dataBase64.slice(dataBase64.indexOf(",") + 1) : dataBase64;
  return Buffer.from(base64, "base64");
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const reportId = await getReportIdByPublicCode(code);
  if (!reportId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = verifyInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });

  const deviceId = await getOrCreateDeviceId();

  const reportRows = await db.execute<{ lon: number; lat: number }>(sql`
    SELECT ST_X(geom) AS lon, ST_Y(geom) AS lat FROM reports WHERE id = ${reportId}
  `);
  const originalPoint = reportRows[0];

  const originalPhotoRows = await db.execute<{ phash: string | null; captured_at: string | null }>(sql`
    SELECT phash, captured_at FROM report_photos WHERE report_id = ${reportId} AND kind = 'initial' ORDER BY created_at ASC LIMIT 1
  `);
  const originalPhoto = originalPhotoRows[0];

  let photoId: string | null = null;
  let distanceFromOriginalM: number | null = null;
  let visualSimilarity: number | null = null;

  if (parsed.data.photo) {
    const { photo } = parsed.data;
    const original = decodeBase64Image(photo.dataBase64);
    const boxes: BlurBox[] = photo.blurBoxes ?? [];
    const processed = boxes.length > 0 ? await processPhotoForPublication(original, boxes) : await stripExif(original);
    const { storageKey } = savePhotoBuffer(processed);
    const phash = await computeImageHash(processed);

    if (photo.gpsLat !== undefined && photo.gpsLng !== undefined && originalPoint) {
      distanceFromOriginalM = haversineDistanceM({ lon: originalPoint.lon, lat: originalPoint.lat }, { lon: photo.gpsLng, lat: photo.gpsLat });
    }
    if (originalPhoto?.phash) {
      visualSimilarity = phashSimilarity(phash, originalPhoto.phash);
    }

    const [photoRow] = await db.execute<{ id: string }>(sql`
      INSERT INTO report_photos (report_id, kind, storage_key, gps_lat, gps_lng, exif_stripped, blur_applied, faces_detected, phash)
      VALUES (${reportId}, 'verification_after', ${`/uploads/${storageKey}`}, ${photo.gpsLat ?? null}, ${photo.gpsLng ?? null}, true, ${boxes.length > 0}, ${boxes.length}, ${phash})
      RETURNING id
    `);
    photoId = photoRow.id;
  }

  const check = checkClosurePhoto({
    distanceFromOriginalM: distanceFromOriginalM ?? 0,
    maxAllowedRadiusM: MAX_VERIFICATION_RADIUS_M,
    originalCapturedAt: originalPhoto?.captured_at ? new Date(originalPhoto.captured_at) : new Date(0),
    verificationCapturedAt: new Date(),
    visualSimilarity,
    verificationGpsAccuracyM: parsed.data.photo?.gpsAccuracyM ?? null,
  });

  const [attempt] = await db.execute<{ id: string }>(sql`
    INSERT INTO verification_attempts (report_id, verifier_device_id, outcome, photo_id, distance_from_original_m, similarity_score, mismatch_flagged, mismatch_reason)
    VALUES (${reportId}, ${deviceId}, ${parsed.data.outcome}, ${photoId}, ${distanceFromOriginalM}, ${visualSimilarity}, ${check.mismatchSuspected}, ${check.mismatchSuspected ? check.explanation : null})
    RETURNING id
  `);

  const reopens = outcomeReopensTimeline(parsed.data.outcome);
  const newStatus = reopens ? "reopened" : parsed.data.outcome === "verified_fixed" ? "verified_fixed" : "resolved_by_authority";
  const timelineType =
    parsed.data.outcome === "verified_fixed"
      ? "citizen_verified_fixed"
      : parsed.data.outcome === "partially_fixed"
        ? "citizen_verified_partial"
        : parsed.data.outcome === "not_fixed_disputed"
          ? "citizen_disputed"
          : "cannot_verify";

  await db.execute(sql`UPDATE reports SET status = ${newStatus} WHERE id = ${reportId}`);
  await db.execute(sql`
    INSERT INTO timeline_events (report_id, type, actor_type, payload)
    VALUES (${reportId}, ${timelineType}, 'citizen', ${JSON.stringify({ mismatchSuspected: check.mismatchSuspected, note: parsed.data.note ?? null })})
  `);

  await appendAudit({
    actorType: "citizen",
    action: "verification_submitted",
    entityType: "report",
    entityId: reportId,
    payload: { outcome: parsed.data.outcome, mismatchSuspected: check.mismatchSuspected, verificationAttemptId: attempt.id },
  });

  return NextResponse.json({
    verificationAttemptId: attempt.id,
    check,
    newStatus,
  });
}
