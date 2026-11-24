import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, reports, reportPhotos, timelineEvents } from "@/lib/db/schema";
import { findWardForPoint, nearbyOpenReports } from "@/lib/geo/queries";
import { pointSql, fuzzPoint } from "@/lib/geo/point";
import { routeReport } from "@/lib/routing/route";
import { scoreDuplicate, textJaccardSimilarity } from "@/lib/duplicate/detect";
import { generatePublicCode } from "./publicCode";
import { processPhotoForPublication, stripExif, type BlurBox } from "@/lib/privacy/image";
import { savePhotoBuffer } from "@/lib/storage/local";
import { computeImageHash } from "@/lib/media/phash";
import { appendAudit } from "@/lib/audit/log";
import { isEmergencyCategory } from "@/lib/catalog/categories";

const photoInputSchema = z.object({
  dataBase64: z.string().min(1),
  capturedAt: z.string().datetime().optional(),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  blurBoxes: z
    .array(z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }))
    .max(20)
    .optional(),
});

export const createReportInputSchema = z.object({
  categorySlug: z.string().min(1),
  categoryConfidence: z.number().min(0).max(1).optional(),
  categorySource: z.enum(["manual", "heuristic", "model"]).default("manual"),
  descriptionEn: z.string().max(2000).optional(),
  descriptionTa: z.string().max(2000).optional(),
  voiceTranscript: z.string().max(4000).optional(),
  voiceLocale: z.enum(["en", "ta"]).optional(),
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  locationAccuracyM: z.number().min(0).max(10000).optional(),
  landmarkText: z.string().max(300).optional(),
  isSensitive: z.boolean().default(false),
  photos: z.array(photoInputSchema).min(1).max(4),
  confirmDespiteDuplicates: z.boolean().default(false),
});

export type CreateReportInput = z.infer<typeof createReportInputSchema>;

export class EmergencyCategoryError extends Error {
  constructor() {
    super("This category is an emergency and must use the emergency flow, not the normal report flow.");
  }
}

export class DuplicatesFoundError extends Error {
  constructor(public readonly candidates: { reportId: string; publicCode: string; score: number }[]) {
    super("Possible duplicate reports found nearby.");
  }
}

export interface CreateReportResult {
  reportId: string;
  publicCode: string;
  agencyId: string | null;
  routingStatus: string;
  routingConfidence: number;
}

function decodeBase64Image(dataBase64: string): Buffer {
  const base64 = dataBase64.includes(",") ? dataBase64.slice(dataBase64.indexOf(",") + 1) : dataBase64;
  return Buffer.from(base64, "base64");
}

export async function createReport(input: CreateReportInput, reporterDeviceId: string): Promise<CreateReportResult> {
  if (isEmergencyCategory(input.categorySlug)) {
    throw new EmergencyCategoryError();
  }

  const [categoryRow] = await db.select().from(categories).where(eq(categories.slug, input.categorySlug)).limit(1);
  if (!categoryRow) throw new Error(`Unknown category slug: ${input.categorySlug}`);

  const ward = await findWardForPoint({ lon: input.lon, lat: input.lat });

  // Duplicate detection: same category, within 80m, scored against the new
  // report's own description. A human decides whether to "add their voice"
  // instead of filing a new report — we never silently merge reports.
  if (!input.confirmDespiteDuplicates) {
    const nearby = await nearbyOpenReports({ lon: input.lon, lat: input.lat }, 80, { categoryId: categoryRow.id, limit: 10 });
    const candidates = nearby
      .map((n) => ({
        reportId: n.id,
        publicCode: n.publicCode,
        score: scoreDuplicate({
          distanceM: n.distanceM,
          sameCategory: true,
          textSimilarity: textJaccardSimilarity(input.descriptionEn ?? "", n.descriptionEn ?? ""),
          imageSimilarity: null,
        }).score,
      }))
      .filter((c) => c.score >= 0.62)
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) throw new DuplicatesFoundError(candidates);
  }

  const route = await routeReport({ categoryId: categoryRow.id, wardId: ward?.wardId ?? null, zoneId: ward?.zoneId ?? null });
  const publicCode = generatePublicCode();
  const displayGeom = input.isSensitive ? fuzzPoint({ lon: input.lon, lat: input.lat }, 120) : null;

  const [reportRow] = await db
    .insert(reports)
    .values({
      publicCode,
      reporterDeviceId,
      categoryId: categoryRow.id,
      categoryConfidence: input.categoryConfidence ?? null,
      categorySource: input.categorySource,
      descriptionEn: input.descriptionEn ?? null,
      descriptionTa: input.descriptionTa ?? null,
      voiceTranscript: input.voiceTranscript ?? null,
      voiceLocale: input.voiceLocale ?? null,
      geom: pointSql({ lon: input.lon, lat: input.lat }),
      locationAccuracyM: input.locationAccuracyM ?? null,
      landmarkText: input.landmarkText ?? null,
      wardId: ward?.wardId ?? null,
      zoneId: ward?.zoneId ?? null,
      agencyId: route.agencyId,
      routingConfidence: route.confidence,
      routingStatus: route.status,
      routingNotes: route.reason,
      isSensitive: input.isSensitive,
      displayGeom: displayGeom ? pointSql(displayGeom) : null,
      status: "open",
    })
    .returning({ id: reports.id });

  for (const photo of input.photos) {
    const original = decodeBase64Image(photo.dataBase64);
    const boxes: BlurBox[] = photo.blurBoxes ?? [];
    const processed = boxes.length > 0 ? await processPhotoForPublication(original, boxes) : await stripExif(original);
    const { storageKey } = savePhotoBuffer(processed);
    const phash = await computeImageHash(processed);

    await db.insert(reportPhotos).values({
      reportId: reportRow.id,
      kind: "initial",
      storageKey: `/uploads/${storageKey}`,
      capturedAt: photo.capturedAt ? new Date(photo.capturedAt) : null,
      gpsLat: photo.gpsLat ?? null,
      gpsLng: photo.gpsLng ?? null,
      exifStripped: true,
      blurApplied: boxes.length > 0,
      facesDetected: boxes.length,
      phash,
    });
  }

  await db.insert(timelineEvents).values({
    reportId: reportRow.id,
    type: "reported",
    actorType: "citizen",
    payload: { source: "web" },
  });

  await appendAudit({
    actorType: "citizen",
    action: "report_created",
    entityType: "report",
    entityId: reportRow.id,
    payload: { publicCode, categorySlug: input.categorySlug, agencyId: route.agencyId, routingStatus: route.status },
  });

  return {
    reportId: reportRow.id,
    publicCode,
    agencyId: route.agencyId,
    routingStatus: route.status,
    routingConfidence: route.confidence,
  };
}
