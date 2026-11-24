import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  customType,
  uniqueIndex,
  index,
  serial,
} from "drizzle-orm/pg-core";
/**
 * Geometry columns are declared for typing purposes only. DDL (including SRID,
 * subtype and GIST indexes) is owned by the hand-written SQL migrations in
 * /migrations — see src/lib/db/migrate.ts. Reads/writes always go through
 * ST_AsGeoJSON / ST_GeomFromGeoJSON helpers in src/lib/geo, never raw driver
 * mapping, because PostGIS's EWKB wire format isn't worth parsing in JS.
 */
const geometry = customType<{ data: string }>({
  dataType() {
    return "geometry";
  },
});

export const userRoleEnum = pgEnum("user_role", [
  "citizen",
  "volunteer",
  "moderator",
  "authority",
  "admin",
]);

export const agencyKindEnum = pgEnum("agency_kind", [
  "corporation",
  "water_sewage",
  "electricity",
  "highways",
  "other",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "verified",
  "unverified",
  "stale",
]);

export const routingStatusEnum = pgEnum("routing_status", [
  "auto",
  "user_corrected",
  "owner_unknown",
  "review_queue",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "draft",
  "open",
  "filed",
  "acknowledged",
  "in_progress",
  "resolved_by_authority",
  "verified_fixed",
  "disputed",
  "reopened",
  "escalated",
  "closed",
]);

export const timelineEventTypeEnum = pgEnum("timeline_event_type", [
  "reported",
  "filed",
  "acknowledged",
  "work_started",
  "resolved_by_authority",
  "citizen_verified_fixed",
  "citizen_verified_partial",
  "citizen_disputed",
  "cannot_verify",
  "reopened",
  "escalated",
  "closed",
  "note",
  "routing_corrected",
]);

export const actorTypeEnum = pgEnum("actor_type", [
  "citizen",
  "volunteer",
  "authority",
  "system",
  "moderator",
]);

export const verificationOutcomeEnum = pgEnum("verification_outcome", [
  "verified_fixed",
  "partially_fixed",
  "not_fixed_disputed",
  "cannot_verify",
]);

export const photoKindEnum = pgEnum("photo_kind", ["initial", "verification"]);

export const contactKindEnum = pgEnum("contact_kind", [
  "phone",
  "email",
  "portal",
  "app",
  "rti",
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "pending",
  "upheld",
  "dismissed",
]);

export const duplicateStatusEnum = pgEnum("duplicate_status", [
  "suggested",
  "confirmed",
  "dismissed",
]);

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reputationScore: integer("reputation_score").default(0).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").references(() => devices.id),
  emailHash: varchar("email_hash", { length: 128 }),
  phoneHash: varchar("phone_hash", { length: 128 }),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  role: userRoleEnum("role").default("citizen").notNull(),
  reputationScore: integer("reputation_score").default(0).notNull(),
  verifiedVolunteerSince: timestamp("verified_volunteer_since", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Administrative geography
// ---------------------------------------------------------------------------

export const zones = pgTable("zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneNumber: integer("zone_number").notNull(),
  nameEn: varchar("name_en", { length: 120 }).notNull(),
  nameTa: varchar("name_ta", { length: 120 }).notNull(),
  geom: geometry("geom"),
  sourceUrl: text("source_url"),
  sourceDate: timestamp("source_date", { withTimezone: true }),
});

export const wards = pgTable("wards", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id").references(() => zones.id),
  wardNumber: integer("ward_number").notNull(),
  nameEn: varchar("name_en", { length: 120 }).notNull(),
  nameTa: varchar("name_ta", { length: 120 }).notNull(),
  geom: geometry("geom"),
  populationEstimate: integer("population_estimate"),
  sourceUrl: text("source_url"),
  sourceDate: timestamp("source_date", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Agencies, categories, SLAs
// ---------------------------------------------------------------------------

export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  nameEn: varchar("name_en", { length: 160 }).notNull(),
  nameTa: varchar("name_ta", { length: 160 }).notNull(),
  kind: agencyKindEnum("kind").notNull(),
  website: text("website"),
  verificationStatus: verificationStatusEnum("verification_status").default("unverified").notNull(),
  sourceUrl: text("source_url"),
  sourceDate: timestamp("source_date", { withTimezone: true }),
  notes: text("notes"),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  parentId: uuid("parent_id"),
  nameEn: varchar("name_en", { length: 120 }).notNull(),
  nameTa: varchar("name_ta", { length: 120 }).notNull(),
  icon: varchar("icon", { length: 40 }).default("alert-triangle").notNull(),
  isEmergency: boolean("is_emergency").default(false).notNull(),
  defaultAgencyKind: agencyKindEnum("default_agency_kind"),
});

/** Editable routing rules: which agency owns which category in which area. */
export const agencyJurisdictions = pgTable(
  "agency_jurisdictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .references(() => agencies.id)
      .notNull(),
    categoryId: uuid("category_id").references(() => categories.id),
    wardId: uuid("ward_id").references(() => wards.id),
    zoneId: uuid("zone_id").references(() => zones.id),
    /** Higher wins when multiple rules match the same report. */
    priority: integer("priority").default(0).notNull(),
    notes: text("notes"),
    sourceUrl: text("source_url"),
    sourceDate: timestamp("source_date", { withTimezone: true }),
    active: boolean("active").default(true).notNull(),
  },
  (t) => [index("agency_jurisdictions_category_idx").on(t.categoryId, t.wardId)]
);

export const slaTargets = pgTable("sla_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .references(() => categories.id)
    .notNull(),
  agencyId: uuid("agency_id").references(() => agencies.id),
  targetHours: integer("target_hours").notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  sourceLabel: text("source_label").notNull(),
  sourceUrl: text("source_url"),
  sourceDate: timestamp("source_date", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicCode: varchar("public_code", { length: 12 }).notNull().unique(),
    reporterUserId: uuid("reporter_user_id").references(() => users.id),
    reporterDeviceId: uuid("reporter_device_id").references(() => devices.id),

    categoryId: uuid("category_id")
      .references(() => categories.id)
      .notNull(),
    categoryConfidence: doublePrecision("category_confidence"),
    categorySource: varchar("category_source", { length: 20 }).default("manual").notNull(), // manual | model | heuristic

    descriptionEn: text("description_en"),
    descriptionTa: text("description_ta"),
    voiceTranscript: text("voice_transcript"),
    voiceLocale: varchar("voice_locale", { length: 5 }),

    geom: geometry("geom").notNull(),
    locationAccuracyM: doublePrecision("location_accuracy_m"),
    landmarkText: text("landmark_text"),
    wardId: uuid("ward_id").references(() => wards.id),
    zoneId: uuid("zone_id").references(() => zones.id),

    agencyId: uuid("agency_id").references(() => agencies.id),
    routingConfidence: doublePrecision("routing_confidence"),
    routingStatus: routingStatusEnum("routing_status").default("review_queue").notNull(),
    routingNotes: text("routing_notes"),

    isSensitive: boolean("is_sensitive").default(false).notNull(),
    displayGeom: geometry("display_geom"), // fuzzed point shown publicly when isSensitive

    status: reportStatusEnum("status").default("open").notNull(),
    officialReferenceNumber: varchar("official_reference_number", { length: 80 }),
    officialFiledAt: timestamp("official_filed_at", { withTimezone: true }),
    slaDeadline: timestamp("sla_deadline", { withTimezone: true }),

    supporterCount: integer("supporter_count").default(1).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("reports_status_idx").on(t.status),
    index("reports_ward_idx").on(t.wardId),
    index("reports_category_idx").on(t.categoryId),
  ]
);

export const reportPhotos = pgTable("report_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .references(() => reports.id)
    .notNull(),
  kind: photoKindEnum("kind").default("initial").notNull(),
  storageKey: text("storage_key").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  gpsLat: doublePrecision("gps_lat"),
  gpsLng: doublePrecision("gps_lng"),
  exifStripped: boolean("exif_stripped").default(false).notNull(),
  blurApplied: boolean("blur_applied").default(false).notNull(),
  facesDetected: integer("faces_detected").default(0).notNull(),
  platesDetected: integer("plates_detected").default(0).notNull(),
  phash: varchar("phash", { length: 64 }),
  flaggedStaleOrScreenshot: boolean("flagged_stale_or_screenshot").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reportSupporters = pgTable(
  "report_supporters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .references(() => reports.id)
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    deviceId: uuid("device_id").references(() => devices.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("report_supporters_unique").on(t.reportId, t.deviceId)]
);

export const duplicateCandidates = pgTable("duplicate_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .references(() => reports.id)
    .notNull(),
  candidateReportId: uuid("candidate_report_id")
    .references(() => reports.id)
    .notNull(),
  score: doublePrecision("score").notNull(),
  basis: jsonb("basis").notNull(), // { distanceM, sameCategory, textSimilarity, imageSimilarity }
  status: duplicateStatusEnum("status").default("suggested").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const timelineEvents = pgTable(
  "timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .references(() => reports.id)
      .notNull(),
    type: timelineEventTypeEnum("type").notNull(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    payload: jsonb("payload").default({}).notNull(),
    evidencePhotoId: uuid("evidence_photo_id").references(() => reportPhotos.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("timeline_events_report_idx").on(t.reportId, t.createdAt)]
);

export const verificationAttempts = pgTable("verification_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .references(() => reports.id)
    .notNull(),
  verifierUserId: uuid("verifier_user_id").references(() => users.id),
  verifierDeviceId: uuid("verifier_device_id").references(() => devices.id),
  outcome: verificationOutcomeEnum("outcome").notNull(),
  photoId: uuid("photo_id").references(() => reportPhotos.id),
  distanceFromOriginalM: doublePrecision("distance_from_original_m"),
  hoursSinceClosure: doublePrecision("hours_since_closure"),
  similarityScore: doublePrecision("similarity_score"),
  mismatchFlagged: boolean("mismatch_flagged").default(false).notNull(),
  mismatchReason: text("mismatch_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

export const escalationContacts = pgTable("escalation_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id").references(() => agencies.id),
  labelEn: varchar("label_en", { length: 160 }).notNull(),
  labelTa: varchar("label_ta", { length: 160 }).notNull(),
  kind: contactKindEnum("kind").notNull(),
  value: text("value").notNull(),
  verificationStatus: verificationStatusEnum("verification_status").default("unverified").notNull(),
  sourceUrl: text("source_url"),
  sourceDate: timestamp("source_date", { withTimezone: true }),
  checkedBy: varchar("checked_by", { length: 80 }),
});

export const escalationLadders = pgTable("escalation_ladders", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id)
    .notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  /** Ordered steps: [{ level, labelEn, labelTa, contactId, waitHours, templateKey }] */
  steps: jsonb("steps").notNull(),
});

export const escalationSends = pgTable("escalation_sends", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .references(() => reports.id)
    .notNull(),
  ladderStep: integer("ladder_step").notNull(),
  templateKey: varchar("template_key", { length: 80 }).notNull(),
  sentVia: varchar("sent_via", { length: 40 }).notNull(), // copied | shared | open311
  sentByUserId: uuid("sent_by_user_id").references(() => users.id),
  sentByDeviceId: uuid("sent_by_device_id").references(() => devices.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Open311
// ---------------------------------------------------------------------------

export const open311Authorities = pgTable("open311_authorities", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id")
    .references(() => agencies.id)
    .notNull(),
  jurisdictionId: varchar("jurisdiction_id", { length: 160 }).notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  apiKeyEnvVar: varchar("api_key_env_var", { length: 80 }),
  permissionDocUrl: text("permission_doc_url").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Moderation & abuse resistance
// ---------------------------------------------------------------------------

export const moderationFlags = pgTable("moderation_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").references(() => reports.id),
  flaggedByUserId: uuid("flagged_by_user_id").references(() => users.id),
  flaggedByDeviceId: uuid("flagged_by_device_id").references(() => devices.id),
  reason: text("reason").notNull(),
  status: moderationStatusEnum("status").default("pending").notNull(),
  resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const rateLimitEvents = pgTable(
  "rate_limit_events",
  {
    id: serial("id").primaryKey(),
    identity: varchar("identity", { length: 128 }).notNull(),
    action: varchar("action", { length: 40 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("rate_limit_events_identity_idx").on(t.identity, t.action, t.createdAt)]
);

// ---------------------------------------------------------------------------
// Immutable, hash-chained audit log
// ---------------------------------------------------------------------------

export const auditLog = pgTable("audit_log", {
  seq: serial("seq").primaryKey(),
  prevHash: varchar("prev_hash", { length: 64 }).notNull(),
  hash: varchar("hash", { length: 64 }).notNull(),
  actorType: actorTypeEnum("actor_type").notNull(),
  actorId: uuid("actor_id"),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id"),
  payload: jsonb("payload").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Neighbourhood groups
// ---------------------------------------------------------------------------

export const neighbourhoodGroups = pgTable("neighbourhood_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  wardId: uuid("ward_id").references(() => wards.id),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .references(() => neighbourhoodGroups.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    role: varchar("role", { length: 20 }).default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("group_members_unique").on(t.groupId, t.userId)]
);

export const groupBundles = pgTable("group_bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .references(() => neighbourhoodGroups.id)
    .notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  reportIds: jsonb("report_ids").notNull(), // uuid[] as json for simplicity
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
