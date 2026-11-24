# Ooru Kural (ஊரு குரல்)

Chennai civic issue reporter & accountability tracker. Independent project,
**not affiliated with Greater Chennai Corporation, Metro Water, TANGEDCO, or
any government body.** The app name lives in one place
(`src/config/app.ts`) so it can be renamed without touching anything else.

This README is written to be honest about what is actually built, tested,
and verified in this environment, and what is not — see **Evaluation** and
**Known limitations** below before relying on anything here for a real
deployment.

## What this is

A mobile-first, installable, bilingual (Tamil/English) PWA for reporting
civic issues (potholes, garbage, streetlights, drainage, stray animals,
etc.), routing them to the right Chennai agency, tracking them through to
resolution against a published-or-reported (never guaranteed) service-level
target, verifying closures with a human in the loop, and escalating
unresolved issues through a configurable ladder (reminder → zonal →
regional → state grievance → CPGRAMS → RTI). It never impersonates an
authority, never scrapes official portals, never auto-submits anything on a
citizen's behalf, and never names or criticizes individual officials.

## Run steps

Prerequisites: Node.js 20+, and either Docker or Podman for local Postgres.

```bash
npm install

# 1. Start PostgreSQL + PostGIS (Podman by default; edit package.json's
#    db:up script if you use Docker instead)
npm run db:up

# 2. Copy env and fill in SESSION_SECRET (everything else has a safe default
#    for local dev)
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
# paste the output into SESSION_SECRET in .env.local

# 3. Apply the schema (hand-written SQL migrations, not drizzle-kit generated
#    — PostGIS DDL needs explicit SRID/geometry-subtype/GIST-index control)
npm run db:migrate

# 4. Seed demo data: 3 Chennai wards (synthetic boundaries — see "Data
#    sources" below), 4 agencies, ~25 categories, routing rules, escalation
#    ladders, and ~64 realistic demo reports in different states
npm run db:seed

# 5. Run the app
npm run dev
# http://localhost:3000 -> redirects to /en (or /ta)
```

Other scripts: `npm test` (Vitest, runs everything in `tests/`), `npm run
db:reset` (drop + recreate schema + reseed), `npm run icons:generate`
(regenerates PWA icons from an inline SVG).

## Architecture, in brief

- **Next.js 16 App Router + TypeScript**, locale-prefixed routes
  (`src/app/[locale]/...`) via next-intl. Tailwind v4 for styling.
- **PostgreSQL + PostGIS** (`src/lib/db/schema.ts` + hand-written SQL in
  `migrations/`) for the spatial queries (ward lookup, nearby-report radius
  search, map bounding-box queries) — see `src/lib/geo/queries.ts`.
- **Business logic is pure/testable TypeScript**, deliberately separated
  from DB access: agency routing (`src/lib/routing/rules.ts`), SLA clocks
  (`src/lib/sla/clock.ts`), duplicate detection
  (`src/lib/duplicate/detect.ts`), closure verification
  (`src/lib/verification/check.ts`), escalation templates
  (`src/lib/escalation/templates.ts`), the hash-chained audit log
  (`src/lib/audit/chain.ts`), and photo privacy processing
  (`src/lib/privacy/image.ts`). Each has unit tests in `tests/`.
- **MapLibre GL** for the public map (clustering, heatmap, filters) and the
  location picker in the report flow — never hits OpenStreetMap's own tile
  servers directly (see "Data sources").
- **IndexedDB offline queue** (`src/lib/offline/queue.ts`, via `idb`) for
  reports filed with no connection; syncs on the next `online` event rather
  than Background Sync (unreliable on iOS Safari).
- **Hand-written service worker** (`public/sw.js`) instead of `next-pwa`
  (peer-dependency conflicts with Next 16, and a hand-written SW is smaller
  and more predictable for low-end phones anyway).
- **Pseudonymous device identity** (`src/lib/auth/session.ts`): a signed
  random device-id cookie, no login required to file a report. No full
  account/role system (citizen/volunteer/moderator/authority/admin) is built
  — see Known limitations.

## Data sources & licences

Being specific here on purpose, because a civic-accountability tool that is
vague about its own data quality undermines its own premise.

| Data | Status | Source |
|---|---|---|
| Ward/zone boundaries (`src/lib/catalog/wards.ts`) | **Synthetic rectangles**, not real GCC ward polygons | Hand-authored for demo purposes only. Loading real ward boundaries (GCC GIS portal or OSM's Chennai admin boundaries, checking each one's licence) is required before this is usable for real reporting. |
| Categories (`src/lib/catalog/categories.ts`) | Original, not copied from any single source | Informed by FixMyStreet's and Namma Chennai's category taxonomies (UX observation only — no code or data copied) |
| Agencies (`src/lib/catalog/agencies.ts`) | Names/jurisdictions are public knowledge; every agency record is marked `verificationStatus: "unverified"` with notes | — |
| Emergency contacts 112 / 100 / 101 / 108 / CPGRAMS / TN RTI (`src/lib/catalog/contacts.ts`) | **Verified** against an official or near-official source, dated 2026-11-24 | incredibleindia.gov.in, 112.gov.in, pgportal.gov.in, rtionline.tn.gov.in |
| Agency helpline numbers (GCC 1913, Metro Water 1916, TANGEDCO 1912, TN CM helpline) | **Unverified** — third-party sources only, one with conflicting reports | See `sourceUrl`/`checkedBy` on each `ContactDef` |
| Jurisdiction/routing rules (`src/lib/catalog/jurisdictions.ts`) | Original, editable, includes a deliberately contested case (missing manhole covers claimed by both GCC and Metro Water) to exercise the review-queue logic | — |
| SLA/service-level targets | Demo values, not sourced from a specific published GCC/Metro Water SLA document | Marked `isPublished: false` by default so the UI never reads them as a guarantee |
| Map tiles | MapLibre's own public demo style (`demotiles.maplibre.org`), explicitly documented by MapLibre as fine for development/evaluation, not production | Swap `NEXT_PUBLIC_MAP_STYLE_URL` for a provider whose terms cover this use (MapTiler, Stadia, Mapbox) before any real deployment. **Never** points at `tile.openstreetmap.org` directly — that violates OSM's tile usage policy for app traffic. |
| Seed/demo reports (64 reports, 3 wards) | Entirely synthetic, generated by `src/lib/db/seed.ts` with a seeded PRNG for reproducibility | Not real citizen reports |

### Adding a real agency and escalation ladder

1. Add a row to `AGENCIES` in `src/lib/catalog/agencies.ts` (slug, names,
   kind, contact info) and re-run `npm run db:seed` (or write a one-off
   migration/insert for production data).
2. Add one or more `JurisdictionRule`-shaped rows to `JURISDICTION_RULES` in
   `src/lib/catalog/jurisdictions.ts` — scope by category, ward, zone, or
   leave both null for a city-wide rule. `chooseAgencyRoute`
   (`src/lib/routing/rules.ts`) scores by specificity automatically; if two
   agencies' rules are close in specificity, it marks the report
   `review_queue` instead of guessing.
3. Add contacts to `CONTACTS` in `src/lib/catalog/contacts.ts`, each with
   `verificationStatus`, `sourceUrl`, `sourceDate`, and `checkedBy` — never
   mark something `"verified"` without an actual source check. This is what
   gates whether the emergency screen will show it with confidence or with
   an "unverified, confirm locally" caveat.
4. Add a ladder to `LADDERS` in `src/lib/catalog/ladders.ts` using
   `defaultSteps()` (reminder → zonal → regional → state grievance →
   CPGRAMS → RTI, with wait-hours per step) or a fully custom `steps` array.
5. If the agency publishes a GeoReport v2 Open311 endpoint **and** you have
   written permission to use it, add a row to `open311_authorities` with
   `permissionDocUrl` set and `enabled: true` — otherwise the connector in
   `src/lib/open311/client.ts` stays dormant. No Chennai agency is known to
   publish one as of this build, so this path is untested against anything
   real (see Known limitations).

## Privacy & abuse model

- **Minimum data collection.** No login required to file a report; identity
  is a signed, pseudonymous device cookie (`src/lib/auth/session.ts`), not a
  phone number or email.
- **Photo privacy, automatic and non-optional.** Every uploaded photo goes
  through `src/lib/privacy/image.ts`: EXIF is stripped unconditionally, and
  any face/plate regions the citizen marks are irreversibly pixelated
  (downscale-then-upscale, baked into the output JPEG — verified by a test
  that a sharp.js pitfall, chaining `.resize()` twice on one pipeline, had
  silently defeated the pixelation).
- **Location fuzzing.** Reports marked sensitive get a randomized
  bearing/distance offset (`src/lib/geo/point.ts`, 40–100% of a configurable
  radius) baked into `display_geom`; the true `geom` is never exposed on the
  public map or API for a sensitive report.
- **Rate limiting** (`src/lib/moderation/rateLimit.ts`) on report creation,
  supporting, flagging, and escalation sends, backed by a real DB-counted
  sliding window, not just a client-side check.
- **Moderation queue** (`/admin/moderation`, `src/app/api/moderation/`) for
  flagged reports — **no access control is implemented on this route**,
  see Known limitations.
- **Hash-chained, append-only audit log** (`src/lib/audit/chain.ts` +
  `src/lib/audit/log.ts`): every mutating action is appended under a
  Postgres advisory lock so concurrent writers can't fork the chain, and a
  Postgres trigger blocks `UPDATE`/`DELETE` on the table (it does **not**
  block `TRUNCATE` — a documented gap, not a security feature with a false
  sense of completeness). `GET /api/audit/verify` re-walks and re-hashes the
  whole chain on demand.
- **Decision support, never automatic verdicts.** Routing confidence,
  category suggestions, duplicate-detection scores, and closure-verification
  flags are all surfaced to a human to confirm or override — none of them
  silently changes a report's state without that human step, and the UI
  never hides the uncertainty (`common.unverified`,
  `common.estimatedNotGuaranteed`, `common.ownerUnknown` are real, used
  strings, not aspirational copy).
- **Emergencies never enter the report queue.** Categories marked
  `isEmergency` are excluded from the report form's category picker, and
  the API rejects creating a report with an emergency category
  (`EmergencyCategoryError` in `src/lib/reports/create.ts`) — they route to
  `/emergency` instead, which only shows numbers with
  `verificationStatus: "verified"` as a confident "call now" action.

## Evaluation

This section is meant to be read literally, not as a progress bar. Automated
tests are real and passing; everything else that requires real-world data
collection has **not** been run in this environment, and is reported as such
rather than fabricated.

### What was actually run and is passing

- **67 unit tests across 13 files** (`npm test`), covering: agency-routing
  specificity scoring and contested-ownership detection, SLA deadline/
  overdue/reminder-tier math, duplicate-detection scoring (location/text/
  image-similarity blend), closure-verification mismatch flags, escalation
  message templates (including a regex check that no template ever
  resolves to an individual official's name), the audit hash chain
  (generation and tamper detection), perceptual-image-hash similarity
  (average-hash over real generated images, not mocked), the heuristic
  category classifier, rate-limit threshold logic, an Open311 GeoReport v2
  client against a mocked HTTP endpoint, and the two messaging-bot payload
  parsers.
- **End-to-end manual verification against the real seeded
  Postgres/PostGIS instance** (not just unit tests, documented at the time
  it was done): created a report through the live API with a real photo
  (confirmed EXIF-stripped and average-hashed), had it routed by the real
  jurisdiction rules, filed it (confirmed the SLA deadline was computed
  correctly), added a supporter, generated and "sent" an escalation
  message, flagged it for moderation, submitted a closure verification, and
  confirmed: a near-duplicate report at the same spot correctly triggers a
  409 with a real similarity score instead of silently merging; an
  emergency-category submission is correctly rejected; the audit chain's
  `checkedRows`/`valid` grows correctly after each mutation; every
  conditional UI section on the tracking page (filing form, verification
  form, escalation panel) shows up only when the report's actual state
  calls for it, across reports in `open`, `filed`, `resolved_by_authority`,
  `reopened`, and `escalated` states pulled from the seeded data.
- `tsc --noEmit` is clean across the whole project at every commit in this
  build.

### What was not run, and is not fabricated here

Per the brief's explicit instruction not to invent data this environment
cannot actually collect:

- **No 500+ photo labelled classification test set, no confusion matrix.**
  There is no vision-language model wired in at all — `CLASSIFIER_MODEL`/
  `AI_GATEWAY_API_KEY` exist in `src/lib/env.ts` for a future image-based
  suggester, but what actually runs today is a deterministic keyword-overlap
  heuristic (`src/lib/classify/heuristic.ts`, 5 passing unit tests on
  synthetic phrases). Its real-world precision/recall against genuine
  citizen phrasing (especially Tamil, code-mixed, or voice-transcribed
  text) is unknown.
- **No 150+ real routing-scenario test against verified official
  jurisdiction boundaries.** `tests/routing.test.ts` covers the *logic*
  (specificity scoring, contested-ownership detection) with synthetic
  fixtures, not real Chennai ward/agency jurisdiction data, because the
  ward boundaries in this build are synthetic (see Data sources).
- **No real multi-week pilot with volunteers.** There are no real users of
  this build. Nothing here should be read as pilot results.
- **No usability testing with real people** (8+, Tamil-first/older-user
  representation as the brief asked for). The UI follows WCAG 2.2 AA
  conventions mechanically (48px touch targets, visible focus rings,
  `prefers-reduced-motion`, bilingual labels) but has not been watched-used
  by an actual person outside this build process.
- **No abuse-burst testing against a live deployment.** Rate limiting and
  the moderation queue are implemented and unit-tested, but not exercised
  under real adversarial traffic.
- **The Tamil copy throughout (UI strings and escalation templates) is
  functional civic-register Tamil produced during this build, not reviewed
  by a native Tamil speaker.** It should be treated as a first draft, not
  verified content, until someone does that review.

Treat every number in the ward-dashboard UI the same way the UI itself
labels it: a citizen-reported figure from a brand-new seeded demo dataset,
not a statistic about real Chennai civic conditions.

## What's built vs. not built

Built: data model + migrations, agency routing with contested-ownership
handling, SLA clocks, duplicate detection, closure verification, escalation
ladder + bilingual templates, hash-chained audit log, photo EXIF-strip +
blur, Chennai catalog data (honestly marked verified/unverified), seed data,
i18n (en/ta) + PWA shell + service worker, device-identity sessions, rate
limiting, Open311 client (untested against a live authority), report
creation/detail/tracking/support/file/verify/escalate/flag APIs, ward
dashboards, the public map (cluster/heatmap/filters), the report-capture
wizard (photo/location/category/description, tap-to-blur, offline queue,
Web Speech voice input), the tracking page, a ward-dashboard UI, a
moderation-queue UI, and WhatsApp/Telegram intake webhooks that acknowledge
and link back to the web flow.

Not built, called out rather than silently skipped: real account/role
system beyond the pseudonymous device cookie; access control on
`/admin/moderation` and the moderation API; production-grade object storage
(uploaded photos currently land on local disk — `src/lib/storage/local.ts`
— which will not survive a serverless/ephemeral filesystem deploy);
signed/time-limited media URLs; a VLM-based category suggester; real ward
boundaries; a native Tamil-speaker review pass; in-chat (rather than
link-out) bot report filing; group-action bundling UI for the escalation
ladder; "monsoon mode"; CSV/open-data export; and any of the real-world
evaluation listed above as not run.

## Known limitations (consolidated)

- No auth/role gate on `/admin/moderation` or its API — do not deploy this
  publicly without adding one.
- Local-disk photo storage (`src/lib/storage/local.ts`) is a dev-only stand-in
  for a real object store; swap it before deploying anywhere with an
  ephemeral filesystem.
- `audit_log`'s immutability trigger blocks `UPDATE`/`DELETE` but not
  `TRUNCATE` — a real deployment should also restrict the DB role's
  privileges on that table.
- Ward/zone boundaries are synthetic rectangles, not real GCC geography.
- Only 6 of the ~14 catalogued contacts are independently verified; the rest
  carry an explicit `"unverified"` status and render with a caveat in the UI
  — never silently upgrade one to verified without checking its source.
- Map tiles default to MapLibre's own dev/eval-only demo style.
- The heuristic category classifier is keyword-based, not a trained or
  vision-based model, and its real-world accuracy is unmeasured.
- Open311 integration has no live authority endpoint to test against.
- WhatsApp/Telegram webhooks acknowledge-and-link-out only; they do not run
  the full capture flow inside a chat conversation.
- Tamil copy has not had a native-speaker review pass.
- No real-world pilot, usability study, or abuse-burst test has been run
  (see Evaluation).
