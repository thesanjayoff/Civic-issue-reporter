import { describe, it, expect } from "vitest";
import { scoreDuplicate, textJaccardSimilarity, phashSimilarity } from "@/lib/duplicate/detect";

describe("scoreDuplicate", () => {
  it("scores zero when categories differ, regardless of proximity", () => {
    const result = scoreDuplicate({ distanceM: 2, sameCategory: false, textSimilarity: 1, imageSimilarity: 1 });
    expect(result.score).toBe(0);
    expect(result.isDuplicateCandidate).toBe(false);
  });

  it("flags a near-identical same-category, same-spot report as a duplicate candidate", () => {
    const result = scoreDuplicate({ distanceM: 3, sameCategory: true, textSimilarity: 0.8, imageSimilarity: 0.9 });
    expect(result.isDuplicateCandidate).toBe(true);
    expect(result.score).toBeGreaterThan(0.62);
  });

  it("does not flag reports of the same category far apart", () => {
    const result = scoreDuplicate({ distanceM: 500, sameCategory: true, textSimilarity: 0.5, imageSimilarity: 0.4 });
    expect(result.isDuplicateCandidate).toBe(false);
  });

  it("still works when image similarity is unavailable (reweights to distance+text)", () => {
    const result = scoreDuplicate({ distanceM: 1, sameCategory: true, textSimilarity: 0.9, imageSimilarity: null });
    expect(result.isDuplicateCandidate).toBe(true);
  });
});

describe("textJaccardSimilarity", () => {
  it("is 1 for identical text", () => {
    expect(textJaccardSimilarity("pothole on anna salai", "pothole on anna salai")).toBe(1);
  });

  it("is 0 for completely disjoint text", () => {
    expect(textJaccardSimilarity("streetlight broken", "garbage pile up")).toBe(0);
  });

  it("handles Tamil text", () => {
    const sim = textJaccardSimilarity("சாலையில் பெரிய குழி உள்ளது", "இந்த சாலையில் குழி உள்ளது");
    expect(sim).toBeGreaterThan(0.3);
  });
});

describe("phashSimilarity", () => {
  it("is 1 for identical hashes", () => {
    expect(phashSimilarity("abcd1234", "abcd1234")).toBe(1);
  });

  it("decreases as hashes diverge", () => {
    const close = phashSimilarity("ffff0000", "ffff0001");
    const far = phashSimilarity("ffff0000", "00000000");
    expect(close).toBeGreaterThan(far);
  });
});
