import { describe, it, expect } from "vitest";
import { checkClosurePhoto, outcomeReopensTimeline } from "@/lib/verification/check";

const baseInput = {
  distanceFromOriginalM: 5,
  maxAllowedRadiusM: 30,
  originalCapturedAt: new Date("2026-01-01T10:00:00Z"),
  verificationCapturedAt: new Date("2026-01-10T10:00:00Z"),
  visualSimilarity: 0.8,
  verificationGpsAccuracyM: 10,
};

describe("checkClosurePhoto", () => {
  it("passes a clean same-place, same-ish-view verification", () => {
    const result = checkClosurePhoto(baseInput);
    expect(result.mismatchSuspected).toBe(false);
    expect(result.flags).toHaveLength(0);
  });

  it("flags a photo taken far from the original pin", () => {
    const result = checkClosurePhoto({ ...baseInput, distanceFromOriginalM: 400 });
    expect(result.flags).toContain("location_out_of_radius");
    expect(result.mismatchSuspected).toBe(true);
  });

  it("flags a visually dissimilar photo even if GPS matches", () => {
    const result = checkClosurePhoto({ ...baseInput, visualSimilarity: 0.05 });
    expect(result.flags).toContain("visual_mismatch");
    expect(result.mismatchSuspected).toBe(true);
  });

  it("flags poor GPS accuracy without asserting mismatch on its own", () => {
    const result = checkClosurePhoto({ ...baseInput, verificationGpsAccuracyM: 200 });
    expect(result.flags).toContain("gps_accuracy_too_low");
    expect(result.mismatchSuspected).toBe(false);
  });

  it("flags a verification photo timestamped before the original report", () => {
    const result = checkClosurePhoto({
      ...baseInput,
      verificationCapturedAt: new Date("2025-12-01T00:00:00Z"),
    });
    expect(result.flags).toContain("timestamp_before_original");
  });

  it("degrades confidence gracefully when visual similarity cannot be computed", () => {
    const result = checkClosurePhoto({ ...baseInput, visualSimilarity: null });
    expect(result.confidence).not.toBe("high");
  });
});

describe("outcomeReopensTimeline", () => {
  it("reopens on dispute and on cannot-verify", () => {
    expect(outcomeReopensTimeline("not_fixed_disputed")).toBe(true);
    expect(outcomeReopensTimeline("cannot_verify")).toBe(true);
  });

  it("does not reopen on fixed outcomes", () => {
    expect(outcomeReopensTimeline("verified_fixed")).toBe(false);
    expect(outcomeReopensTimeline("partially_fixed")).toBe(false);
  });
});
