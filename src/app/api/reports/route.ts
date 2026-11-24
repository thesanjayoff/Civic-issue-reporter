import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getOrCreateDeviceId } from "@/lib/auth/session";
import { createReport, createReportInputSchema, DuplicatesFoundError, EmergencyCategoryError } from "@/lib/reports/create";
import { checkAndRecordRateLimit, RATE_LIMIT_RULES } from "@/lib/moderation/rateLimit";
import { reportsForMap } from "@/lib/geo/queries";

export async function POST(req: NextRequest) {
  const deviceId = await getOrCreateDeviceId();

  const allowed = await checkAndRecordRateLimit(deviceId, RATE_LIMIT_RULES.createReport);
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited", message: "Too many reports from this device recently. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createReportInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await createReport(parsed.data, deviceId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof EmergencyCategoryError) {
      return NextResponse.json({ error: "emergency_category", message: err.message }, { status: 400 });
    }
    if (err instanceof DuplicatesFoundError) {
      return NextResponse.json({ error: "possible_duplicates", candidates: err.candidates }, { status: 409 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "validation_failed", issues: err.issues }, { status: 400 });
    }
    console.error("Failed to create report", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minLon = Number(searchParams.get("minLon"));
  const minLat = Number(searchParams.get("minLat"));
  const maxLon = Number(searchParams.get("maxLon"));
  const maxLat = Number(searchParams.get("maxLat"));

  if ([minLon, minLat, maxLon, maxLat].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "invalid_bbox" }, { status: 400 });
  }

  const categoryIds = searchParams.get("categoryIds")?.split(",").filter(Boolean);
  const status = searchParams.get("status")?.split(",").filter(Boolean);
  const wardId = searchParams.get("wardId") ?? undefined;

  const results = await reportsForMap({ minLon, minLat, maxLon, maxLat, categoryIds, status, wardId });
  return NextResponse.json({ reports: results });
}
