import { describe, it, expect } from "vitest";
import { suggestCategory } from "@/lib/classify/heuristic";
import { CATEGORIES } from "@/lib/catalog/categories";

describe("suggestCategory (heuristic keyword classifier)", () => {
  it("suggests pothole for a pothole-ish description", () => {
    const result = suggestCategory("There is a big pothole on the road near my house, very deep hole", CATEGORIES);
    expect(result?.slug).toBe("pothole");
  });

  it("suggests streetlight_not_working for a dark street description", () => {
    const result = suggestCategory("The streetlight on our road is not working, it's completely dark at night", CATEGORIES);
    expect(result?.slug).toBe("streetlight_not_working");
  });

  it("suggests garbage_not_collected for a garbage pile description", () => {
    const result = suggestCategory("Garbage has piled up and not been collected for a week, bad smell", CATEGORIES);
    expect(result?.slug).toBe("garbage_not_collected");
  });

  it("returns null for text with no keyword overlap", () => {
    const result = suggestCategory("asdf qwer zxcv", CATEGORIES);
    expect(result).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(suggestCategory("", CATEGORIES)).toBeNull();
  });
});
