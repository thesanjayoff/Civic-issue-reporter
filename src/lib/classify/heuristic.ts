/**
 * Heuristic category suggestion — a real keyword-overlap classifier, not a
 * stub. This is the documented fallback for when no vision-language model
 * call is configured (no VLM is wired into this build; see README "Known
 * limitations" — CLASSIFIER_MODEL/AI_GATEWAY_API_KEY exist in env.ts for a
 * future image-based suggester, but this heuristic is what actually runs
 * today). It only ever *suggests*; the citizen always sees and can correct
 * the pick (categorySource stays "heuristic" until they touch it).
 */
import { textJaccardSimilarity } from "@/lib/duplicate/detect";
import type { CategoryDef } from "@/lib/catalog/categories";

const KEYWORDS: Record<string, string> = {
  pothole: "pothole road hole crater asphalt tar damaged surface",
  broken_road_edge: "road edge broken shoulder footpath crack",
  streetlight_not_working: "streetlight street light lamp post dark night not working bulb",
  garbage_not_collected: "garbage trash waste rubbish bin not collected pile smell",
  dead_animal: "dead animal carcass dog cat cow rotting",
  stray_dogs: "stray dog dogs bite pack aggressive",
  drain_blocked: "drain blocked clogged overflow stagnant",
  open_manhole: "manhole cover open missing hole uncovered",
  sewage_overflow: "sewage overflow smell drain leak waste water",
  no_water_supply: "no water supply dry tap pipeline",
  water_leak: "water leak pipe burst leaking wastage",
  encroachment: "encroachment footpath blocked illegal construction vendor hawker",
  severe_flooding_danger: "flood flooding waterlogged knee deep danger",
};

const CONFIDENCE_THRESHOLD = 0.12;

export interface HeuristicSuggestion {
  slug: string;
  confidence: number;
}

/** Returns the best-matching non-emergency category by keyword overlap with `text`, or null if nothing clears the threshold. */
export function suggestCategory(text: string, categories: CategoryDef[]): HeuristicSuggestion | null {
  if (!text.trim()) return null;

  let best: HeuristicSuggestion | null = null;
  for (const category of categories) {
    const keywords = KEYWORDS[category.slug];
    if (!keywords) continue;
    const score = textJaccardSimilarity(text, keywords);
    if (score >= CONFIDENCE_THRESHOLD && (!best || score > best.confidence)) {
      best = { slug: category.slug, confidence: Math.min(0.85, score * 2) };
    }
  }
  return best;
}
