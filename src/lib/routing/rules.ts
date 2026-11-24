/**
 * Pure agency-routing logic, kept free of DB calls so it is cheap to unit
 * test against the 150+ scenario fixtures (see tests/routing.test.ts).
 * src/lib/routing/route.ts wires this up to real jurisdiction rows.
 */

export interface JurisdictionRule {
  agencyId: string;
  categoryId: string | null; // null = applies to any category
  wardId: string | null; // null = applies to any ward
  zoneId: string | null; // null = applies to any zone
  priority: number;
}

export interface RouteContext {
  categoryId: string;
  wardId: string | null;
  zoneId: string | null;
}

export type RoutingStatus = "auto" | "owner_unknown" | "review_queue";

export interface RouteResult {
  agencyId: string | null;
  confidence: number;
  status: RoutingStatus;
  matchedRule: JurisdictionRule | null;
  candidates: string[]; // other plausible agency ids, for "likely owners" UI
  reason: string;
}

/**
 * Specificity score for ranking competing rules: exact ward+category beats
 * zone-level, which beats a city-wide default-by-category rule.
 */
function specificity(rule: JurisdictionRule, ctx: RouteContext): number {
  let score = rule.priority * 100;
  if (rule.wardId && rule.wardId === ctx.wardId) score += 30;
  if (!rule.wardId && rule.zoneId && rule.zoneId === ctx.zoneId) score += 20;
  if (rule.categoryId && rule.categoryId === ctx.categoryId) score += 10;
  return score;
}

function ruleMatches(rule: JurisdictionRule, ctx: RouteContext): boolean {
  if (rule.categoryId && rule.categoryId !== ctx.categoryId) return false;
  if (rule.wardId && rule.wardId !== ctx.wardId) return false;
  if (rule.zoneId && rule.zoneId !== ctx.zoneId) return false;
  return true;
}

function confidenceFor(rule: JurisdictionRule, ctx: RouteContext): number {
  const wardExact = Boolean(rule.wardId && rule.wardId === ctx.wardId);
  const categoryExact = Boolean(rule.categoryId && rule.categoryId === ctx.categoryId);
  const zoneExact = Boolean(rule.zoneId && rule.zoneId === ctx.zoneId);

  if (wardExact && categoryExact) return 0.95;
  if (wardExact) return 0.8;
  if (zoneExact && categoryExact) return 0.85;
  if (zoneExact) return 0.7;
  // A deliberate, explicit city-wide rule for this exact category (e.g. "the
  // water board owns all water-leak reports everywhere") is confident even
  // without ward/zone specificity — that specificity only matters for
  // categories whose ownership genuinely varies by area (e.g. roads).
  if (categoryExact && !rule.wardId && !rule.zoneId) return 0.85;
  return 0.3; // fully generic catch-all rule (no category/ward/zone match at all)
}

export function chooseAgencyRoute(
  rules: JurisdictionRule[],
  ctx: RouteContext
): RouteResult {
  const matching = rules.filter((r) => ruleMatches(r, ctx));

  if (matching.length === 0) {
    return {
      agencyId: null,
      confidence: 0,
      status: "owner_unknown",
      matchedRule: null,
      candidates: [],
      reason: "No jurisdiction rule matches this category/ward/zone combination.",
    };
  }

  const ranked = [...matching].sort((a, b) => specificity(b, ctx) - specificity(a, ctx));
  const best = ranked[0];
  const bestScore = specificity(best, ctx);
  const confidence = confidenceFor(best, ctx);

  // Other agencies tied (or close) on specificity are surfaced as candidates
  // so the UI can say "likely owners" instead of asserting one answer.
  const candidateIds = Array.from(
    new Set(
      ranked
        .filter((r) => r.agencyId !== best.agencyId && specificity(r, ctx) > bestScore - 10)
        .map((r) => r.agencyId)
    )
  );

  // A near-tie between two different agencies means ownership is genuinely
  // contested (e.g. two rules of equal specificity naming different
  // agencies) — that always goes to review, no matter how confident either
  // individual rule looked in isolation.
  const contested = candidateIds.length > 0;
  const status: RoutingStatus = !contested && confidence >= 0.6 ? "auto" : "review_queue";
  const effectiveConfidence = contested ? Math.min(confidence, 0.5) : confidence;

  return {
    agencyId: best.agencyId,
    confidence: effectiveConfidence,
    status,
    matchedRule: best,
    candidates: candidateIds,
    reason: contested
      ? "More than one agency rule plausibly applies — ownership is contested and needs confirmation."
      : confidence >= 0.8
        ? "Matched an exact ward + category jurisdiction rule."
        : confidence >= 0.6
          ? "Matched a zone-level or explicit city-wide category rule."
          : "Only a generic/fallback rule matched — ownership should be confirmed.",
  };
}
