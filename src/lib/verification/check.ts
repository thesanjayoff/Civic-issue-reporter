/**
 * Closure verification: decision *support*, never an automatic verdict (per
 * product principles — a human always confirms outcome). Flags same-place
 * mismatches the way the spec calls out explicitly: "closures with photos of
 * the wrong location have been reported."
 */

export interface ClosurePhotoCheckInput {
  distanceFromOriginalM: number;
  maxAllowedRadiusM: number;
  originalCapturedAt: Date;
  verificationCapturedAt: Date;
  /** 0..1 perceptual-hash-based visual similarity to the original "before" photo. */
  visualSimilarity: number | null;
  /** GPS accuracy radius reported by the device for the verification photo, if known. */
  verificationGpsAccuracyM: number | null;
}

export type ClosureCheckFlag =
  | "location_out_of_radius"
  | "visual_mismatch"
  | "gps_accuracy_too_low"
  | "timestamp_before_original";

export interface ClosureCheckResult {
  flags: ClosureCheckFlag[];
  mismatchSuspected: boolean;
  confidence: "high" | "medium" | "low";
  explanation: string;
}

const VISUAL_MISMATCH_THRESHOLD = 0.35; // below this, "same place" is doubtful
const LOW_GPS_ACCURACY_M = 50;

export function checkClosurePhoto(input: ClosurePhotoCheckInput): ClosureCheckResult {
  const flags: ClosureCheckFlag[] = [];

  if (input.distanceFromOriginalM > input.maxAllowedRadiusM) {
    flags.push("location_out_of_radius");
  }
  if (input.visualSimilarity !== null && input.visualSimilarity < VISUAL_MISMATCH_THRESHOLD) {
    flags.push("visual_mismatch");
  }
  if (input.verificationGpsAccuracyM !== null && input.verificationGpsAccuracyM > LOW_GPS_ACCURACY_M) {
    flags.push("gps_accuracy_too_low");
  }
  if (input.verificationCapturedAt.getTime() < input.originalCapturedAt.getTime()) {
    flags.push("timestamp_before_original");
  }

  const mismatchSuspected = flags.includes("location_out_of_radius") || flags.includes("visual_mismatch");

  let confidence: ClosureCheckResult["confidence"] = "high";
  if (flags.includes("gps_accuracy_too_low")) confidence = "medium";
  if (input.visualSimilarity === null) confidence = confidence === "high" ? "medium" : "low";

  const explanation = mismatchSuspected
    ? "This verification photo looks like it may be from a different place than the original report. Flagged for human review before the closure is accepted."
    : flags.length > 0
      ? "Minor data-quality issues detected (not necessarily wrong location) — still recommended for a quick human check."
      : "Location and visual similarity checks are consistent with the original report.";

  return { flags, mismatchSuspected, confidence, explanation };
}

export type VerificationOutcome = "verified_fixed" | "partially_fixed" | "not_fixed_disputed" | "cannot_verify";

/** A dispute or "cannot verify" always reopens the timeline per the escalation ladder. */
export function outcomeReopensTimeline(outcome: VerificationOutcome): boolean {
  return outcome === "not_fixed_disputed" || outcome === "cannot_verify";
}
