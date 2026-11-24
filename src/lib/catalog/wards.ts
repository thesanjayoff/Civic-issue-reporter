/**
 * Demo administrative geography. These polygons are SYNTHETIC rectangles
 * drawn over real Chennai neighbourhood names for a believable seed demo —
 * they are NOT the official GCC ward boundaries and must never be presented
 * as such. Real boundaries would come from the corporation's own GIS/open
 * data (see README "Data sources & licences") and get loaded the same way,
 * through this same seed pipeline, once sourced and dated.
 */

export interface ZoneDef {
  slug: string;
  zoneNumber: number;
  nameEn: string;
  nameTa: string;
  /** WKT MultiPolygon, SRID 4326. */
  wkt: string;
  sourceUrl: string | null;
  sourceDate: string;
}

export interface WardDef {
  slug: string;
  zoneSlug: string;
  wardNumber: number;
  nameEn: string;
  nameTa: string;
  wkt: string;
  populationEstimate: number;
  sourceUrl: string | null;
  sourceDate: string;
}

function rectWkt(minLon: number, minLat: number, maxLon: number, maxLat: number): string {
  return `MULTIPOLYGON((( ${minLon} ${minLat}, ${maxLon} ${minLat}, ${maxLon} ${maxLat}, ${minLon} ${maxLat}, ${minLon} ${minLat} )))`;
}

export const ZONES: ZoneDef[] = [
  {
    slug: "zone-demo-9",
    zoneNumber: 9,
    nameEn: "Zone 9 — Teynampet (demo boundary)",
    nameTa: "மண்டலம் 9 — தேனாம்பேட்டை (செயற்கை எல்லை)",
    wkt: rectWkt(80.233, 13.03, 80.267, 13.06),
    sourceUrl: null,
    sourceDate: "2026-11-24",
  },
];

export const WARDS: WardDef[] = [
  {
    slug: "ward-demo-t-nagar",
    zoneSlug: "zone-demo-9",
    wardNumber: 115,
    nameEn: "T. Nagar (demo boundary)",
    nameTa: "தி.நகர் (செயற்கை எல்லை)",
    wkt: rectWkt(80.233, 13.03, 80.25, 13.045),
    populationEstimate: 42000,
    sourceUrl: null,
    sourceDate: "2026-11-24",
  },
  {
    slug: "ward-demo-nandanam",
    zoneSlug: "zone-demo-9",
    wardNumber: 116,
    nameEn: "Nandanam (demo boundary)",
    nameTa: "நந்தனம் (செயற்கை எல்லை)",
    wkt: rectWkt(80.25, 13.03, 80.267, 13.045),
    populationEstimate: 31000,
    sourceUrl: null,
    sourceDate: "2026-11-24",
  },
  {
    slug: "ward-demo-vadapalani",
    zoneSlug: "zone-demo-9",
    wardNumber: 117,
    nameEn: "Vadapalani (demo boundary)",
    nameTa: "வடபழனி (செயற்கை எல்லை)",
    wkt: rectWkt(80.233, 13.045, 80.25, 13.06),
    populationEstimate: 38500,
    sourceUrl: null,
    sourceDate: "2026-11-24",
  },
];
