/**
 * Seeds the demo dataset: catalog data (categories, agencies, wards,
 * contacts, ladders, jurisdiction rules) plus ~60 realistic reports across
 * the three demo wards so the app looks complete on first run. Idempotent —
 * truncates app tables first, so `npm run db:seed` can be re-run freely.
 *
 * Deliberately NOT real data where that matters: ward boundaries are
 * synthetic rectangles, photos are generated placeholders, and status
 * histories are synthetic but run through the same routing/SLA/duplicate/
 * verification logic the app itself uses — see README "Known limitations".
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";
import { mulberry32, pick, randInt, randFloat, weightedPick, type Rng } from "@/lib/util/prng";
import { CATEGORIES } from "@/lib/catalog/categories";
import { AGENCIES } from "@/lib/catalog/agencies";
import { CONTACTS } from "@/lib/catalog/contacts";
import { ZONES, WARDS } from "@/lib/catalog/wards";
import { JURISDICTION_RULES } from "@/lib/catalog/jurisdictions";
import { LADDERS } from "@/lib/catalog/ladders";
import { chooseAgencyRoute, type JurisdictionRule } from "@/lib/routing/rules";
import { computeSlaDeadline } from "@/lib/sla/clock";
import { checkClosurePhoto } from "@/lib/verification/check";
import { scoreDuplicate } from "@/lib/duplicate/detect";
import { ensureSeedMedia } from "./seed-media";

const rng: Rng = mulberry32(42);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
const sql = postgres(databaseUrl, { max: 1 });

function genPublicCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 7; i++) code += chars[Math.floor(rng() * chars.length)];
  return `OK-${code}`;
}

const WARD_LANDMARKS: Record<string, { en: string; ta: string }[]> = {
  "ward-demo-t-nagar": [
    { en: "near Pondy Bazaar, T. Nagar", ta: "பாண்டி பஜார் அருகில், தி.நகர்" },
    { en: "Panagal Park, T. Nagar", ta: "பனகல் பூங்கா, தி.நகர்" },
    { en: "North Usman Road, T. Nagar", ta: "வட உஸ்மான் சாலை, தி.நகர்" },
    { en: "Thyagaraya Road, T. Nagar", ta: "தியாகராய சாலை, தி.நகர்" },
  ],
  "ward-demo-nandanam": [
    { en: "Nandanam signal", ta: "நந்தனம் சிக்னல்" },
    { en: "near Sathyodayam junction, Nandanam", ta: "சத்யோதயம் சந்திப்பு அருகில், நந்தனம்" },
    { en: "GST Road service lane, Nandanam", ta: "GST சாலை சர்வீஸ் லேன், நந்தனம்" },
  ],
  "ward-demo-vadapalani": [
    { en: "Vadapalani signal", ta: "வடபழனி சிக்னல்" },
    { en: "Arcot Road, Vadapalani", ta: "ஆற்காடு சாலை, வடபழனி" },
    { en: "near MGR statue junction, Vadapalani", ta: "MGR சிலை சந்திப்பு அருகில், வடபழனி" },
  ],
};

const WARD_BBOX: Record<string, { minLon: number; minLat: number; maxLon: number; maxLat: number }> = {
  "ward-demo-t-nagar": { minLon: 80.233, minLat: 13.03, maxLon: 80.25, maxLat: 13.045 },
  "ward-demo-nandanam": { minLon: 80.25, minLat: 13.03, maxLon: 80.267, maxLat: 13.045 },
  "ward-demo-vadapalani": { minLon: 80.233, minLat: 13.045, maxLon: 80.25, maxLat: 13.06 },
};

const NON_EMERGENCY_LEAF_CATEGORIES = CATEGORIES.filter((c) => !c.isEmergency && CATEGORIES.every((x) => x.parentSlug !== c.slug));

type StatusLiteral =
  | "open"
  | "filed"
  | "acknowledged"
  | "in_progress"
  | "resolved_by_authority"
  | "verified_fixed"
  | "disputed"
  | "reopened"
  | "escalated"
  | "closed";

const STATUS_WEIGHTS: [StatusLiteral, number][] = [
  ["open", 15],
  ["filed", 13],
  ["acknowledged", 12],
  ["in_progress", 13],
  ["resolved_by_authority", 9],
  ["verified_fixed", 16],
  ["disputed", 6],
  ["reopened", 5],
  ["escalated", 6],
  ["closed", 5],
];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function truncateAll() {
  console.log("Truncating app tables...");
  await sql`TRUNCATE TABLE
    group_bundles, group_members, neighbourhood_groups,
    rate_limit_events, moderation_flags,
    open311_authorities,
    escalation_sends, escalation_ladders, escalation_contacts,
    verification_attempts, timeline_events, duplicate_candidates,
    report_supporters, report_photos, reports,
    sla_targets, agency_jurisdictions, categories, agencies,
    wards, zones, users, devices,
    audit_log
    RESTART IDENTITY CASCADE`;
}

async function seedZonesAndWards() {
  const zoneIdBySlug = new Map<string, string>();
  for (const z of ZONES) {
    const [row] = await sql`
      INSERT INTO zones (zone_number, name_en, name_ta, geom, source_url, source_date)
      VALUES (${z.zoneNumber}, ${z.nameEn}, ${z.nameTa}, ST_GeomFromText(${z.wkt}, 4326), ${z.sourceUrl}, ${z.sourceDate})
      RETURNING id`;
    zoneIdBySlug.set(z.slug, row.id);
  }

  const wardIdBySlug = new Map<string, string>();
  for (const w of WARDS) {
    const zoneId = zoneIdBySlug.get(w.zoneSlug) ?? null;
    const [row] = await sql`
      INSERT INTO wards (zone_id, ward_number, name_en, name_ta, geom, population_estimate, source_url, source_date)
      VALUES (${zoneId}, ${w.wardNumber}, ${w.nameEn}, ${w.nameTa}, ST_GeomFromText(${w.wkt}, 4326), ${w.populationEstimate}, ${w.sourceUrl}, ${w.sourceDate})
      RETURNING id`;
    wardIdBySlug.set(w.slug, row.id);
  }
  return { zoneIdBySlug, wardIdBySlug };
}

async function seedAgencies() {
  const agencyIdBySlug = new Map<string, string>();
  for (const a of AGENCIES) {
    const [row] = await sql`
      INSERT INTO agencies (slug, name_en, name_ta, kind, website, verification_status, source_url, source_date, notes)
      VALUES (${a.slug}, ${a.nameEn}, ${a.nameTa}, ${a.kind}, ${a.website}, ${a.verificationStatus}, ${a.sourceUrl}, ${a.sourceDate}, ${a.notes})
      RETURNING id`;
    agencyIdBySlug.set(a.slug, row.id);
  }
  return agencyIdBySlug;
}

async function seedCategories() {
  const categoryIdBySlug = new Map<string, string>();
  for (const c of CATEGORIES) {
    const parentId = c.parentSlug ? categoryIdBySlug.get(c.parentSlug) ?? null : null;
    const [row] = await sql`
      INSERT INTO categories (slug, parent_id, name_en, name_ta, icon, is_emergency, default_agency_kind)
      VALUES (${c.slug}, ${parentId}, ${c.nameEn}, ${c.nameTa}, ${c.icon}, ${c.isEmergency}, ${c.defaultAgencyKind})
      RETURNING id`;
    categoryIdBySlug.set(c.slug, row.id);
  }
  return categoryIdBySlug;
}

async function seedJurisdictionsAndSla(
  agencyIdBySlug: Map<string, string>,
  categoryIdBySlug: Map<string, string>,
  wardIdBySlug: Map<string, string>
) {
  const insertedRules: { categoryId: string; agencyId: string; wardId: string | null }[] = [];
  for (const r of JURISDICTION_RULES) {
    const agencyId = agencyIdBySlug.get(r.agencySlug);
    const categoryId = r.categorySlug ? categoryIdBySlug.get(r.categorySlug) ?? null : null;
    const wardId = r.wardSlug ? wardIdBySlug.get(r.wardSlug) ?? null : null;
    if (!agencyId) continue;
    await sql`
      INSERT INTO agency_jurisdictions (agency_id, category_id, ward_id, zone_id, priority, notes, active)
      VALUES (${agencyId}, ${categoryId}, ${wardId}, NULL, ${r.priority}, ${r.notes}, true)`;
    if (categoryId) insertedRules.push({ categoryId, agencyId, wardId });
  }

  // One illustrative SLA target per (category, primary city-wide agency).
  const seen = new Set<string>();
  for (const rule of insertedRules.filter((r) => r.wardId === null)) {
    const key = `${rule.categoryId}:${rule.agencyId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cat = CATEGORIES.find((c) => categoryIdBySlug.get(c.slug) === rule.categoryId);
    if (!cat) continue;
    await sql`
      INSERT INTO sla_targets (category_id, agency_id, target_hours, is_published, source_label, source_url, source_date)
      VALUES (${rule.categoryId}, ${rule.agencyId}, ${cat.defaultSlaHours}, false,
        ${"Illustrative default — no verified, dated official SLA publication was found for this category as of this build (see README limitations)."},
        NULL, ${new Date().toISOString()})`;
  }
}

async function seedContactsAndLadders(agencyIdBySlug: Map<string, string>) {
  const contactIdByKey = new Map<string, string>();
  for (const c of CONTACTS) {
    const agencyId = c.agencySlug ? agencyIdBySlug.get(c.agencySlug) ?? null : null;
    const [row] = await sql`
      INSERT INTO escalation_contacts (agency_id, label_en, label_ta, kind, value, verification_status, source_url, source_date, checked_by)
      VALUES (${agencyId}, ${c.labelEn}, ${c.labelTa}, ${c.kind}, ${c.value}, ${c.verificationStatus}, ${c.sourceUrl}, ${c.sourceDate}, ${c.checkedBy})
      RETURNING id`;
    contactIdByKey.set(c.key, row.id);
  }

  for (const ladder of LADDERS) {
    const agencyId = agencyIdBySlug.get(ladder.agencySlug);
    if (!agencyId) continue;
    const steps = ladder.steps.map((s) => ({
      level: s.level,
      templateKey: s.templateKey,
      waitHoursAfterPrevious: s.waitHoursAfterPrevious,
      contactId: s.contactKey ? contactIdByKey.get(s.contactKey) ?? null : null,
    }));
    await sql`
      INSERT INTO escalation_ladders (agency_id, category_id, steps)
      VALUES (${agencyId}, NULL, ${JSON.stringify(steps)})`;
  }
  return contactIdByKey;
}

async function seedUsersAndDevices() {
  const devices: string[] = [];
  for (let i = 0; i < 25; i++) {
    const [row] = await sql`INSERT INTO devices DEFAULT VALUES RETURNING id`;
    devices.push(row.id);
  }

  const demoUsers = [
    { name: "Kavitha R. (demo citizen)", role: "citizen" as const },
    { name: "Arun S. (demo citizen)", role: "citizen" as const },
    { name: "Priya M. (demo citizen)", role: "citizen" as const },
    { name: "Suresh K. (demo volunteer)", role: "volunteer" as const },
    { name: "Divya N. (demo volunteer)", role: "volunteer" as const },
    { name: "Moderator (demo)", role: "moderator" as const },
  ];
  const userIds: string[] = [];
  for (const u of demoUsers) {
    const deviceId = pick(devices, rng);
    const [row] = await sql`
      INSERT INTO users (device_id, display_name, role)
      VALUES (${deviceId}, ${u.name}, ${u.role})
      RETURNING id`;
    userIds.push(row.id);
  }
  return { devices, userIds };
}

interface ReportSeed {
  id: string;
  publicCode: string;
  categorySlug: string;
  categoryId: string;
  wardSlug: string;
  wardId: string;
  lon: number;
  lat: number;
  status: StatusLiteral;
  agencyId: string | null;
  createdAt: Date;
  officialFiledAt: Date | null;
  officialReferenceNumber: string | null;
  slaDeadline: Date | null;
}

async function seedReports(
  categoryIdBySlug: Map<string, string>,
  wardIdBySlug: Map<string, string>,
  agencyIdBySlug: Map<string, string>,
  devices: string[],
  userIds: string[],
  mediaPaths: Record<string, string>
) {
  // Load real jurisdiction rules back out of the DB so report routing uses
  // the exact same pure routing function the app uses at request time.
  const ruleRows = await sql<{ agency_id: string; category_id: string | null; ward_id: string | null; zone_id: string | null; priority: number }[]>`
    SELECT agency_id, category_id, ward_id, zone_id, priority FROM agency_jurisdictions WHERE active = true`;
  const rules: JurisdictionRule[] = ruleRows.map((r) => ({
    agencyId: r.agency_id,
    categoryId: r.category_id,
    wardId: r.ward_id,
    zoneId: r.zone_id,
    priority: r.priority,
  }));

  const wardSlugs = Object.keys(WARD_BBOX);
  const mediaKeyForCategory = (slug: string): string => {
    if (slug.includes("pothole") || slug.includes("road")) return "road";
    if (slug.includes("drain") || slug.includes("manhole") || slug.includes("sewage")) return "drain";
    if (slug.includes("streetlight")) return "streetlight";
    if (slug.includes("garbage")) return "garbage";
    if (slug.includes("water") || slug.includes("pipe")) return "water";
    if (slug.includes("power") || slug.includes("wire")) return "power";
    if (slug.includes("dog") || slug.includes("animal")) return "animal";
    return "road";
  };

  const reports: ReportSeed[] = [];
  const REPORT_COUNT = 60;

  for (let i = 0; i < REPORT_COUNT; i++) {
    const wardSlug = weightedPick(
      [
        ["ward-demo-t-nagar", 40],
        ["ward-demo-nandanam", 30],
        ["ward-demo-vadapalani", 30],
      ] as [string, number][],
      rng
    );
    const wardId = wardIdBySlug.get(wardSlug)!;
    const cat = pick(NON_EMERGENCY_LEAF_CATEGORIES, rng);
    const categoryId = categoryIdBySlug.get(cat.slug)!;
    const bbox = WARD_BBOX[wardSlug];
    const lon = randFloat(bbox.minLon, bbox.maxLon, rng);
    const lat = randFloat(bbox.minLat, bbox.maxLat, rng);
    const landmark = pick(WARD_LANDMARKS[wardSlug], rng);

    const status = weightedPick(STATUS_WEIGHTS, rng);
    const createdAt = daysAgo(randInt(2, 90, rng));

    const route = chooseAgencyRoute(rules, { categoryId, wardId, zoneId: null });

    const beyondOpen = status !== "open";
    const officialFiledAt = beyondOpen ? new Date(createdAt.getTime() + randInt(2, 48, rng) * 60 * 60 * 1000) : null;
    const officialReferenceNumber = beyondOpen ? `${(AGENCIES.find((a) => agencyIdBySlug.get(a.slug) === route.agencyId)?.slug ?? "REF").toUpperCase()}-${createdAt.getFullYear()}-${randInt(1000, 9999, rng)}` : null;

    const catDef = CATEGORIES.find((c) => c.slug === cat.slug)!;
    const slaDeadline = officialFiledAt
      ? computeSlaDeadline(officialFiledAt, { targetHours: catDef.defaultSlaHours, isPublished: false, sourceLabel: "demo" })
      : null;

    const reporterDeviceId = pick(devices, rng);
    const reporterUserId = rng() < 0.6 ? pick(userIds, rng) : null;
    const publicCode = genPublicCode();
    const descriptionEn = `${catDef.nameEn} ${landmark.en}. Reported via Ooru Kural demo seed.`;
    const descriptionTa = `${landmark.ta} ${catDef.nameTa}. ஊரு குரல் டெமோ மூலம் பதிவு செய்யப்பட்டது.`;
    const useHeuristic = rng() < 0.3;

    const [row] = await sql`
      INSERT INTO reports (
        public_code, reporter_user_id, reporter_device_id, category_id, category_confidence, category_source,
        description_en, description_ta, geom, location_accuracy_m, landmark_text, ward_id,
        agency_id, routing_confidence, routing_status, routing_notes,
        status, official_reference_number, official_filed_at, sla_deadline, supporter_count, created_at
      ) VALUES (
        ${publicCode}, ${reporterUserId}, ${reporterDeviceId}, ${categoryId}, ${useHeuristic ? randFloat(0.45, 0.92, rng) : null}, ${useHeuristic ? "heuristic" : "manual"},
        ${descriptionEn}, ${descriptionTa}, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${randFloat(5, 35, rng)}, ${landmark.en}, ${wardId},
        ${route.agencyId}, ${route.confidence}, ${route.status}, ${route.reason},
        ${status}, ${officialReferenceNumber}, ${officialFiledAt}, ${slaDeadline}, ${randInt(1, 14, rng)}, ${createdAt}
      ) RETURNING id`;

    reports.push({
      id: row.id,
      publicCode,
      categorySlug: cat.slug,
      categoryId,
      wardSlug,
      wardId,
      lon,
      lat,
      status,
      agencyId: route.agencyId,
      createdAt,
      officialFiledAt,
      officialReferenceNumber,
      slaDeadline,
    });

    // Initial photo.
    const mediaKey = mediaKeyForCategory(cat.slug);
    await sql`
      INSERT INTO report_photos (report_id, kind, storage_key, captured_at, gps_lat, gps_lng, exif_stripped, blur_applied, faces_detected, created_at)
      VALUES (${row.id}, 'initial', ${mediaPaths[mediaKey]}, ${createdAt}, ${lat}, ${lon}, true, ${rng() < 0.4}, ${rng() < 0.4 ? randInt(1, 2, rng) : 0}, ${createdAt})`;

    // Timeline events, in order, matching the status progression.
    const events: { type: string; actorType: string; at: Date }[] = [
      { type: "reported", actorType: "citizen", at: createdAt },
    ];
    let cursor = createdAt;
    if (beyondOpen) {
      cursor = officialFiledAt!;
      events.push({ type: "filed", actorType: "citizen", at: cursor });
    }
    const order: StatusLiteral[] = ["acknowledged", "in_progress", "resolved_by_authority"];
    const eventTypeForStatus: Record<string, string> = { in_progress: "work_started" };
    for (const s of order) {
      if (order.indexOf(s) <= order.indexOf(status) || ["verified_fixed", "disputed", "reopened", "escalated", "closed"].includes(status)) {
        cursor = new Date(cursor.getTime() + randInt(6, 72, rng) * 60 * 60 * 1000);
        events.push({ type: eventTypeForStatus[s] ?? s, actorType: "authority", at: cursor });
      }
      if (s === status) break;
    }
    if (["verified_fixed", "disputed", "reopened", "escalated", "closed"].includes(status)) {
      cursor = new Date(cursor.getTime() + randInt(6, 48, rng) * 60 * 60 * 1000);
      const verifyType = status === "disputed" ? "citizen_disputed" : status === "verified_fixed" ? "citizen_verified_fixed" : "citizen_verified_fixed";
      events.push({ type: verifyType, actorType: "citizen", at: cursor });
    }
    if (status === "reopened" || status === "escalated") {
      cursor = new Date(cursor.getTime() + randInt(6, 24, rng) * 60 * 60 * 1000);
      events.push({ type: status, actorType: "citizen", at: cursor });
    }
    if (status === "closed") {
      cursor = new Date(cursor.getTime() + randInt(12, 48, rng) * 60 * 60 * 1000);
      events.push({ type: "closed", actorType: "authority", at: cursor });
    }

    for (const e of events) {
      await sql`
        INSERT INTO timeline_events (report_id, type, actor_type, payload, created_at)
        VALUES (${row.id}, ${e.type}, ${e.actorType}, '{}', ${e.at})`;
    }

    // Verification attempt for closure-adjacent statuses.
    if (["verified_fixed", "disputed", "reopened"].includes(status)) {
      const isDisputed = status === "disputed" || status === "reopened";
      const distance = isDisputed ? randFloat(80, 400, rng) : randFloat(1, 25, rng);
      const similarity = isDisputed ? randFloat(0.05, 0.3, rng) : randFloat(0.6, 0.95, rng);
      const check = checkClosurePhoto({
        distanceFromOriginalM: distance,
        maxAllowedRadiusM: 30,
        originalCapturedAt: createdAt,
        verificationCapturedAt: cursor,
        visualSimilarity: similarity,
        verificationGpsAccuracyM: randFloat(5, 20, rng),
      });
      const outcome = isDisputed ? "not_fixed_disputed" : "verified_fixed";

      const [photoRow] = await sql`
        INSERT INTO report_photos (report_id, kind, storage_key, captured_at, gps_lat, gps_lng, exif_stripped, created_at)
        VALUES (${row.id}, 'verification', ${mediaPaths["verification-after"]}, ${cursor}, ${lat}, ${lon}, true, ${cursor})
        RETURNING id`;

      await sql`
        INSERT INTO verification_attempts (report_id, verifier_device_id, outcome, photo_id, distance_from_original_m, similarity_score, mismatch_flagged, mismatch_reason, created_at)
        VALUES (${row.id}, ${pick(devices, rng)}, ${outcome}, ${photoRow.id}, ${distance}, ${similarity}, ${check.mismatchSuspected}, ${check.mismatchSuspected ? check.explanation : null}, ${cursor})`;
    }

    // Escalation sends for escalated reports.
    if (status === "escalated") {
      await sql`
        INSERT INTO escalation_sends (report_id, ladder_step, template_key, sent_via, sent_by_device_id, created_at)
        VALUES (${row.id}, 1, 'reminder', 'copied', ${pick(devices, rng)}, ${cursor})`;
      await sql`
        INSERT INTO escalation_sends (report_id, ladder_step, template_key, sent_via, sent_by_device_id, created_at)
        VALUES (${row.id}, 2, 'zonal', 'copied', ${pick(devices, rng)}, ${new Date(cursor.getTime() + 3600_000)})`;
    }

    // Supporters ("add your voice").
    const supporterN = randInt(0, 5, rng);
    const usedDevices = new Set<string>([reporterDeviceId]);
    for (let s = 0; s < supporterN; s++) {
      const d = pick(devices, rng);
      if (usedDevices.has(d)) continue;
      usedDevices.add(d);
      await sql`INSERT INTO report_supporters (report_id, device_id, created_at) VALUES (${row.id}, ${d}, ${createdAt})
        ON CONFLICT DO NOTHING`;
    }
  }

  // Force a handful of genuine near-duplicates (same category, ~10-25m from
  // an existing report) so duplicate detection has something real to find —
  // 60 independently-random points almost never land that close together.
  const duplicateSources = [reports[2], reports[10], reports[25], reports[40]].filter(Boolean);
  for (const src of duplicateSources) {
    const bearing = rng() * 2 * Math.PI;
    const distance = randFloat(10, 25, rng);
    const earthRadiusM = 6378137;
    const latRad = (src.lat * Math.PI) / 180;
    const angularDistance = distance / earthRadiusM;
    const newLat = src.lat + (angularDistance * Math.cos(bearing) * 180) / Math.PI;
    const newLon = src.lon + ((angularDistance * Math.sin(bearing)) / Math.cos(latRad)) * (180 / Math.PI);

    const createdAt = new Date(src.createdAt.getTime() + randInt(1, 12, rng) * 60 * 60 * 1000);
    const publicCode = genPublicCode();
    const catDef = CATEGORIES.find((c) => c.slug === src.categorySlug)!;
    const route = chooseAgencyRoute(rules, { categoryId: src.categoryId, wardId: src.wardId, zoneId: null });
    const reporterDeviceId = pick(devices, rng);

    const [row] = await sql`
      INSERT INTO reports (
        public_code, reporter_device_id, category_id, category_source, description_en, description_ta,
        geom, location_accuracy_m, landmark_text, ward_id, agency_id, routing_confidence, routing_status,
        status, supporter_count, created_at
      ) VALUES (
        ${publicCode}, ${reporterDeviceId}, ${src.categoryId}, 'manual',
        ${`${catDef.nameEn} — same spot as ${src.publicCode}? (demo near-duplicate)`},
        ${`${catDef.nameTa} — ${src.publicCode} அதே இடமா? (டெமோ நகல்)`},
        ST_SetSRID(ST_MakePoint(${newLon}, ${newLat}), 4326), ${randFloat(5, 20, rng)}, ${null}, ${src.wardId},
        ${route.agencyId}, ${route.confidence}, ${route.status}, 'open', 1, ${createdAt}
      ) RETURNING id`;

    await sql`
      INSERT INTO timeline_events (report_id, type, actor_type, payload, created_at)
      VALUES (${row.id}, 'reported', 'citizen', '{}', ${createdAt})`;

    reports.push({
      id: row.id,
      publicCode,
      categorySlug: src.categorySlug,
      categoryId: src.categoryId,
      wardSlug: src.wardSlug,
      wardId: src.wardId,
      lon: newLon,
      lat: newLat,
      status: "open",
      agencyId: route.agencyId,
      createdAt,
      officialFiledAt: null,
      officialReferenceNumber: null,
      slaDeadline: null,
    });
  }

  return reports;
}

async function seedDuplicates(reports: ReportSeed[]) {
  let found = 0;
  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      const a = reports[i];
      const b = reports[j];
      if (a.categorySlug !== b.categorySlug) continue;
      const distanceM =
        haversineApprox(a.lat, a.lon, b.lat, b.lon);
      const result = scoreDuplicate({
        distanceM,
        sameCategory: true,
        textSimilarity: 0.4 + rng() * 0.3,
        imageSimilarity: null,
      });
      if (result.isDuplicateCandidate && found < 6) {
        found++;
        await sql`
          INSERT INTO duplicate_candidates (report_id, candidate_report_id, score, basis, status)
          VALUES (${a.id}, ${b.id}, ${result.score}, ${JSON.stringify(result.basis)}, 'suggested')`;
      }
    }
  }
  console.log(`Seeded ${found} duplicate candidate pair(s).`);
}

function haversineApprox(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function seedModerationAndGroups(reports: ReportSeed[], userIds: string[], wardIdBySlug: Map<string, string>) {
  const flaggable = pick(reports, rng);
  await sql`
    INSERT INTO moderation_flags (report_id, flagged_by_user_id, reason, status, created_at)
    VALUES (${flaggable.id}, ${pick(userIds, rng)}, 'Possible duplicate of an older report in the same block.', 'pending', now())`;

  const dismissed = pick(reports, rng);
  await sql`
    INSERT INTO moderation_flags (report_id, flagged_by_user_id, reason, status, resolved_by_user_id, resolution_notes, created_at, resolved_at)
    VALUES (${dismissed.id}, ${pick(userIds, rng)}, 'Reported as spam.', 'dismissed', ${userIds[userIds.length - 1]}, 'Checked — this is a genuine report with evidence.', now(), now())`;

  const wardId = wardIdBySlug.get("ward-demo-t-nagar")!;
  const [group] = await sql`
    INSERT INTO neighbourhood_groups (name, ward_id, created_by_user_id)
    VALUES ('T. Nagar Residents (demo)', ${wardId}, ${userIds[0]})
    RETURNING id`;
  await sql`INSERT INTO group_members (group_id, user_id, role) VALUES (${group.id}, ${userIds[0]}, 'admin')`;
  await sql`INSERT INTO group_members (group_id, user_id, role) VALUES (${group.id}, ${userIds[1]}, 'member')`;

  const bundleReports = reports.filter((r) => r.wardSlug === "ward-demo-t-nagar").slice(0, 3).map((r) => r.id);
  if (bundleReports.length > 0) {
    await sql`
      INSERT INTO group_bundles (group_id, title, report_ids)
      VALUES (${group.id}, 'Pondy Bazaar stretch — combined request (demo)', ${JSON.stringify(bundleReports)})`;
  }
}

async function main() {
  await truncateAll();
  const mediaPaths = await ensureSeedMedia();
  const { wardIdBySlug } = await seedZonesAndWards();
  const agencyIdBySlug = await seedAgencies();
  const categoryIdBySlug = await seedCategories();
  await seedJurisdictionsAndSla(agencyIdBySlug, categoryIdBySlug, wardIdBySlug);
  await seedContactsAndLadders(agencyIdBySlug);
  const { devices, userIds } = await seedUsersAndDevices();
  const reports = await seedReports(categoryIdBySlug, wardIdBySlug, agencyIdBySlug, devices, userIds, mediaPaths);
  await seedDuplicates(reports);
  await seedModerationAndGroups(reports, userIds, wardIdBySlug);

  console.log(`Seeded ${reports.length} reports across ${WARDS.length} wards.`);
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
