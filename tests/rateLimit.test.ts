import { describe, it, expect } from "vitest";
import { isWithinLimit } from "@/lib/moderation/rateLimitRules";

describe("isWithinLimit", () => {
  const rule = { action: "x", maxEvents: 10, windowMinutes: 60 };

  it("allows when count is below the max", () => {
    expect(isWithinLimit(5, rule)).toBe(true);
  });

  it("blocks once count reaches the max", () => {
    expect(isWithinLimit(10, rule)).toBe(false);
  });

  it("blocks when count exceeds the max", () => {
    expect(isWithinLimit(15, rule)).toBe(false);
  });
});
