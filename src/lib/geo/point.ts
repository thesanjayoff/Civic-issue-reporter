import { sql, type SQL } from "drizzle-orm";

export interface LonLat {
  lon: number;
  lat: number;
}

/** SQL expression constructing a PostGIS geography point for inserts/updates. */
export function pointSql({ lon, lat }: LonLat): SQL {
  return sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;
}

/**
 * Deterministic-looking but non-reversible fuzzing for sensitive report
 * locations shown on the public map. Offsets the point by a random bearing
 * and a distance drawn uniformly from [radiusM * 0.4, radiusM] so the fuzzed
 * point is never suspiciously close to the true one, but stays within a
 * bounded, documented radius (default 120m, roughly a street block).
 */
export function fuzzPoint({ lon, lat }: LonLat, radiusM = 120): LonLat {
  const bearing = Math.random() * 2 * Math.PI;
  const distance = radiusM * (0.4 + Math.random() * 0.6);

  const earthRadiusM = 6378137;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  const angularDistance = distance / earthRadiusM;
  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const newLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  return {
    lat: (newLatRad * 180) / Math.PI,
    lon: (newLonRad * 180) / Math.PI,
  };
}

/** Great-circle distance in meters (haversine) — used in JS-side checks/tests
 * where hitting Postgres isn't necessary (e.g. closure-verification radius). */
export function haversineDistanceM(a: LonLat, b: LonLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
