import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import type { LonLat } from "./point";

export interface WardMatch {
  wardId: string;
  wardNameEn: string;
  wardNameTa: string;
  zoneId: string | null;
  zoneNameEn: string | null;
  zoneNameTa: string | null;
}

/** Finds the ward (and its zone) whose boundary polygon contains a point. */
export async function findWardForPoint({ lon, lat }: LonLat): Promise<WardMatch | null> {
  const rows = await db.execute<{
    ward_id: string;
    ward_name_en: string;
    ward_name_ta: string;
    zone_id: string | null;
    zone_name_en: string | null;
    zone_name_ta: string | null;
  }>(sql`
    SELECT w.id AS ward_id, w.name_en AS ward_name_en, w.name_ta AS ward_name_ta,
           z.id AS zone_id, z.name_en AS zone_name_en, z.name_ta AS zone_name_ta
    FROM wards w
    LEFT JOIN zones z ON z.id = w.zone_id
    WHERE ST_Contains(w.geom, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    wardId: row.ward_id,
    wardNameEn: row.ward_name_en,
    wardNameTa: row.ward_name_ta,
    zoneId: row.zone_id,
    zoneNameEn: row.zone_name_en,
    zoneNameTa: row.zone_name_ta,
  };
}

export interface NearbyReport {
  id: string;
  publicCode: string;
  categoryId: string;
  status: string;
  distanceM: number;
  lon: number;
  lat: number;
}

/** Open reports within `radiusM` meters of a point, nearest first. */
export async function nearbyOpenReports(
  { lon, lat }: LonLat,
  radiusM: number,
  opts: { categoryId?: string; excludeReportId?: string; limit?: number } = {}
): Promise<NearbyReport[]> {
  const limit = opts.limit ?? 20;
  const rows = await db.execute<{
    id: string;
    public_code: string;
    category_id: string;
    status: string;
    distance_m: number;
    lon: number;
    lat: number;
  }>(sql`
    SELECT r.id, r.public_code, r.category_id, r.status,
           ST_Distance(r.geom::geography, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography) AS distance_m,
           ST_X(r.geom) AS lon, ST_Y(r.geom) AS lat
    FROM reports r
    WHERE r.deleted_at IS NULL
      AND r.status NOT IN ('closed')
      AND ST_DWithin(r.geom::geography, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography, ${radiusM})
      ${opts.categoryId ? sql`AND r.category_id = ${opts.categoryId}` : sql``}
      ${opts.excludeReportId ? sql`AND r.id != ${opts.excludeReportId}` : sql``}
    ORDER BY distance_m ASC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    id: r.id,
    publicCode: r.public_code,
    categoryId: r.category_id,
    status: r.status,
    distanceM: Number(r.distance_m),
    lon: Number(r.lon),
    lat: Number(r.lat),
  }));
}

/** Distance in meters between two points, computed by PostGIS (geography). */
export async function distanceMetersPg(a: LonLat, b: LonLat): Promise<number> {
  const rows = await db.execute<{ d: number }>(sql`
    SELECT ST_Distance(
      ST_SetSRID(ST_MakePoint(${a.lon}, ${a.lat}), 4326)::geography,
      ST_SetSRID(ST_MakePoint(${b.lon}, ${b.lat}), 4326)::geography
    ) AS d
  `);
  return Number(rows[0]?.d ?? 0);
}

export interface MapReport {
  id: string;
  publicCode: string;
  categoryId: string;
  status: string;
  wardId: string | null;
  createdAt: string;
  slaDeadline: string | null;
  supporterCount: number;
  lon: number;
  lat: number;
}

/** Public map query: fuzzed location for sensitive reports, bounding-box + filters. */
export async function reportsForMap(bbox: {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  categoryIds?: string[];
  wardId?: string;
  status?: string[];
}): Promise<MapReport[]> {
  const rows = await db.execute<{
    id: string;
    public_code: string;
    category_id: string;
    status: string;
    ward_id: string | null;
    created_at: string;
    sla_deadline: string | null;
    supporter_count: number;
    lon: number;
    lat: number;
  }>(sql`
    SELECT r.id, r.public_code, r.category_id, r.status, r.ward_id, r.created_at,
           r.sla_deadline, r.supporter_count,
           ST_X(COALESCE(r.display_geom, r.geom)) AS lon,
           ST_Y(COALESCE(r.display_geom, r.geom)) AS lat
    FROM reports r
    WHERE r.deleted_at IS NULL
      AND ST_Intersects(
            COALESCE(r.display_geom, r.geom),
            ST_MakeEnvelope(${bbox.minLon}, ${bbox.minLat}, ${bbox.maxLon}, ${bbox.maxLat}, 4326)
          )
      ${bbox.wardId ? sql`AND r.ward_id = ${bbox.wardId}` : sql``}
      ${bbox.categoryIds?.length ? sql`AND r.category_id = ANY(${bbox.categoryIds})` : sql``}
      ${bbox.status?.length ? sql`AND r.status::text = ANY(${bbox.status})` : sql``}
    LIMIT 2000
  `);
  return rows.map((r) => ({
    id: r.id,
    publicCode: r.public_code,
    categoryId: r.category_id,
    status: r.status,
    wardId: r.ward_id,
    createdAt: r.created_at,
    slaDeadline: r.sla_deadline,
    supporterCount: Number(r.supporter_count),
    lon: Number(r.lon),
    lat: Number(r.lat),
  }));
}
