-- Ooru Kural schema. Hand-written (not drizzle-kit generated) because PostGIS
-- geometry subtypes/SRIDs and the audit-log immutability trigger need control
-- that automatic diffing doesn't give us. Keep this file in sync with
-- src/lib/db/schema.ts when either changes. Applied by src/lib/db/migrate.ts.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TYPE user_role AS ENUM ('citizen','volunteer','moderator','authority','admin');
CREATE TYPE agency_kind AS ENUM ('corporation','water_sewage','electricity','highways','other');
CREATE TYPE verification_status AS ENUM ('verified','unverified','stale');
CREATE TYPE routing_status AS ENUM ('auto','user_corrected','owner_unknown','review_queue');
CREATE TYPE report_status AS ENUM ('draft','open','filed','acknowledged','in_progress','resolved_by_authority','verified_fixed','disputed','reopened','escalated','closed');
CREATE TYPE timeline_event_type AS ENUM ('reported','filed','acknowledged','work_started','resolved_by_authority','citizen_verified_fixed','citizen_verified_partial','citizen_disputed','cannot_verify','reopened','escalated','closed','note','routing_corrected');
CREATE TYPE actor_type AS ENUM ('citizen','volunteer','authority','system','moderator');
CREATE TYPE verification_outcome AS ENUM ('verified_fixed','partially_fixed','not_fixed_disputed','cannot_verify');
CREATE TYPE photo_kind AS ENUM ('initial','verification');
CREATE TYPE contact_kind AS ENUM ('phone','email','portal','app','rti');
CREATE TYPE moderation_status AS ENUM ('pending','upheld','dismissed');
CREATE TYPE duplicate_status AS ENUM ('suggested','confirmed','dismissed');

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  reputation_score integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES devices(id),
  email_hash varchar(128),
  phone_hash varchar(128),
  display_name varchar(80) NOT NULL,
  role user_role NOT NULL DEFAULT 'citizen',
  reputation_score integer NOT NULL DEFAULT 0,
  verified_volunteer_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Administrative geography
-- ---------------------------------------------------------------------------

CREATE TABLE zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_number integer NOT NULL,
  name_en varchar(120) NOT NULL,
  name_ta varchar(120) NOT NULL,
  geom geometry(MultiPolygon, 4326),
  source_url text,
  source_date timestamptz
);
CREATE INDEX zones_geom_idx ON zones USING GIST (geom);

CREATE TABLE wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES zones(id),
  ward_number integer NOT NULL,
  name_en varchar(120) NOT NULL,
  name_ta varchar(120) NOT NULL,
  geom geometry(MultiPolygon, 4326),
  population_estimate integer,
  source_url text,
  source_date timestamptz
);
CREATE INDEX wards_geom_idx ON wards USING GIST (geom);

-- ---------------------------------------------------------------------------
-- Agencies, categories, SLAs
-- ---------------------------------------------------------------------------

CREATE TABLE agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(60) NOT NULL UNIQUE,
  name_en varchar(160) NOT NULL,
  name_ta varchar(160) NOT NULL,
  kind agency_kind NOT NULL,
  website text,
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  source_url text,
  source_date timestamptz,
  notes text
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(60) NOT NULL UNIQUE,
  parent_id uuid REFERENCES categories(id),
  name_en varchar(120) NOT NULL,
  name_ta varchar(120) NOT NULL,
  icon varchar(40) NOT NULL DEFAULT 'alert-triangle',
  is_emergency boolean NOT NULL DEFAULT false,
  default_agency_kind agency_kind
);

CREATE TABLE agency_jurisdictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id),
  category_id uuid REFERENCES categories(id),
  ward_id uuid REFERENCES wards(id),
  zone_id uuid REFERENCES zones(id),
  priority integer NOT NULL DEFAULT 0,
  notes text,
  source_url text,
  source_date timestamptz,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX agency_jurisdictions_category_idx ON agency_jurisdictions (category_id, ward_id);

CREATE TABLE sla_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id),
  agency_id uuid REFERENCES agencies(id),
  target_hours integer NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  source_label text NOT NULL,
  source_url text,
  source_date timestamptz
);

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code varchar(12) NOT NULL UNIQUE,
  reporter_user_id uuid REFERENCES users(id),
  reporter_device_id uuid REFERENCES devices(id),

  category_id uuid NOT NULL REFERENCES categories(id),
  category_confidence double precision,
  category_source varchar(20) NOT NULL DEFAULT 'manual',

  description_en text,
  description_ta text,
  voice_transcript text,
  voice_locale varchar(5),

  geom geometry(Point, 4326) NOT NULL,
  location_accuracy_m double precision,
  landmark_text text,
  ward_id uuid REFERENCES wards(id),
  zone_id uuid REFERENCES zones(id),

  agency_id uuid REFERENCES agencies(id),
  routing_confidence double precision,
  routing_status routing_status NOT NULL DEFAULT 'review_queue',
  routing_notes text,

  is_sensitive boolean NOT NULL DEFAULT false,
  display_geom geometry(Point, 4326),

  status report_status NOT NULL DEFAULT 'open',
  official_reference_number varchar(80),
  official_filed_at timestamptz,
  sla_deadline timestamptz,

  supporter_count integer NOT NULL DEFAULT 1,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX reports_geom_idx ON reports USING GIST (geom);
CREATE INDEX reports_status_idx ON reports (status);
CREATE INDEX reports_ward_idx ON reports (ward_id);
CREATE INDEX reports_category_idx ON reports (category_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE report_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id),
  kind photo_kind NOT NULL DEFAULT 'initial',
  storage_key text NOT NULL,
  captured_at timestamptz,
  gps_lat double precision,
  gps_lng double precision,
  exif_stripped boolean NOT NULL DEFAULT false,
  blur_applied boolean NOT NULL DEFAULT false,
  faces_detected integer NOT NULL DEFAULT 0,
  plates_detected integer NOT NULL DEFAULT 0,
  phash varchar(64),
  flagged_stale_or_screenshot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_photos_report_idx ON report_photos (report_id);

CREATE TABLE report_supporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id),
  user_id uuid REFERENCES users(id),
  device_id uuid REFERENCES devices(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX report_supporters_unique ON report_supporters (report_id, device_id);

CREATE TABLE duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id),
  candidate_report_id uuid NOT NULL REFERENCES reports(id),
  score double precision NOT NULL,
  basis jsonb NOT NULL,
  status duplicate_status NOT NULL DEFAULT 'suggested',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX duplicate_candidates_report_idx ON duplicate_candidates (report_id);

CREATE TABLE timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id),
  type timeline_event_type NOT NULL,
  actor_type actor_type NOT NULL,
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  evidence_photo_id uuid REFERENCES report_photos(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX timeline_events_report_idx ON timeline_events (report_id, created_at);

CREATE TABLE verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id),
  verifier_user_id uuid REFERENCES users(id),
  verifier_device_id uuid REFERENCES devices(id),
  outcome verification_outcome NOT NULL,
  photo_id uuid REFERENCES report_photos(id),
  distance_from_original_m double precision,
  hours_since_closure double precision,
  similarity_score double precision,
  mismatch_flagged boolean NOT NULL DEFAULT false,
  mismatch_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_attempts_report_idx ON verification_attempts (report_id);

-- ---------------------------------------------------------------------------
-- Escalation
-- ---------------------------------------------------------------------------

CREATE TABLE escalation_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id),
  label_en varchar(160) NOT NULL,
  label_ta varchar(160) NOT NULL,
  kind contact_kind NOT NULL,
  value text NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  source_url text,
  source_date timestamptz,
  checked_by varchar(80)
);

CREATE TABLE escalation_ladders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id),
  category_id uuid REFERENCES categories(id),
  steps jsonb NOT NULL
);

CREATE TABLE escalation_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id),
  ladder_step integer NOT NULL,
  template_key varchar(80) NOT NULL,
  sent_via varchar(40) NOT NULL,
  sent_by_user_id uuid REFERENCES users(id),
  sent_by_device_id uuid REFERENCES devices(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX escalation_sends_report_idx ON escalation_sends (report_id);

-- ---------------------------------------------------------------------------
-- Open311
-- ---------------------------------------------------------------------------

CREATE TABLE open311_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id),
  jurisdiction_id varchar(160) NOT NULL,
  endpoint_url text NOT NULL,
  api_key_env_var varchar(80),
  permission_doc_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Moderation & abuse resistance
-- ---------------------------------------------------------------------------

CREATE TABLE moderation_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES reports(id),
  flagged_by_user_id uuid REFERENCES users(id),
  flagged_by_device_id uuid REFERENCES devices(id),
  reason text NOT NULL,
  status moderation_status NOT NULL DEFAULT 'pending',
  resolved_by_user_id uuid REFERENCES users(id),
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE rate_limit_events (
  id serial PRIMARY KEY,
  identity varchar(128) NOT NULL,
  action varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_events_identity_idx ON rate_limit_events (identity, action, created_at);

-- ---------------------------------------------------------------------------
-- Immutable, hash-chained audit log.
-- Application code computes hash = sha256(prev_hash || canonical_json(row)).
-- These two rules make tampering/deletion fail loudly instead of silently.
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  seq serial PRIMARY KEY,
  prev_hash varchar(64) NOT NULL,
  hash varchar(64) NOT NULL,
  actor_type actor_type NOT NULL,
  actor_id uuid,
  action varchar(80) NOT NULL,
  entity_type varchar(40) NOT NULL,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows are immutable: % not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- ---------------------------------------------------------------------------
-- Neighbourhood groups
-- ---------------------------------------------------------------------------

CREATE TABLE neighbourhood_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  ward_id uuid REFERENCES wards(id),
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES neighbourhood_groups(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role varchar(20) NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX group_members_unique ON group_members (group_id, user_id);

CREATE TABLE group_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES neighbourhood_groups(id),
  title varchar(160) NOT NULL,
  report_ids jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
