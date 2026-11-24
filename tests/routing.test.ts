import { describe, it, expect } from "vitest";
import { chooseAgencyRoute, type JurisdictionRule } from "@/lib/routing/rules";

const WATER = "agency-water";
const GCC = "agency-gcc";
const TANGEDCO = "agency-power";
const HIGHWAYS = "agency-highways";

const CAT_POTHOLE = "cat-pothole";
const CAT_WATER_LEAK = "cat-water-leak";
const CAT_STREETLIGHT = "cat-streetlight";

const WARD_A = "ward-a";
const WARD_B = "ward-b";
const ZONE_1 = "zone-1";

describe("chooseAgencyRoute", () => {
  it("matches an exact ward + category rule with high confidence", () => {
    const rules: JurisdictionRule[] = [
      { agencyId: GCC, categoryId: CAT_POTHOLE, wardId: WARD_A, zoneId: null, priority: 0 },
      { agencyId: HIGHWAYS, categoryId: CAT_POTHOLE, wardId: WARD_B, zoneId: null, priority: 0 },
    ];
    const result = chooseAgencyRoute(rules, { categoryId: CAT_POTHOLE, wardId: WARD_A, zoneId: ZONE_1 });
    expect(result.agencyId).toBe(GCC);
    expect(result.status).toBe("auto");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("falls back to a city-wide category rule (e.g. one water board) when no ward rule exists", () => {
    const rules: JurisdictionRule[] = [
      { agencyId: WATER, categoryId: CAT_WATER_LEAK, wardId: null, zoneId: null, priority: 0 },
    ];
    const result = chooseAgencyRoute(rules, { categoryId: CAT_WATER_LEAK, wardId: WARD_A, zoneId: ZONE_1 });
    expect(result.agencyId).toBe(WATER);
    expect(result.status).toBe("auto");
  });

  it("returns owner_unknown when nothing matches", () => {
    const result = chooseAgencyRoute([], { categoryId: CAT_STREETLIGHT, wardId: WARD_A, zoneId: ZONE_1 });
    expect(result.agencyId).toBeNull();
    expect(result.status).toBe("owner_unknown");
    expect(result.confidence).toBe(0);
  });

  it("prefers ward-level rule over zone-level rule for the same category", () => {
    const rules: JurisdictionRule[] = [
      { agencyId: HIGHWAYS, categoryId: CAT_POTHOLE, wardId: null, zoneId: ZONE_1, priority: 0 },
      { agencyId: GCC, categoryId: CAT_POTHOLE, wardId: WARD_A, zoneId: null, priority: 0 },
    ];
    const result = chooseAgencyRoute(rules, { categoryId: CAT_POTHOLE, wardId: WARD_A, zoneId: ZONE_1 });
    expect(result.agencyId).toBe(GCC);
  });

  it("surfaces competing agencies as candidates when ownership is contested", () => {
    const rules: JurisdictionRule[] = [
      { agencyId: GCC, categoryId: CAT_POTHOLE, wardId: null, zoneId: null, priority: 0 },
      { agencyId: HIGHWAYS, categoryId: CAT_POTHOLE, wardId: null, zoneId: null, priority: 0 },
    ];
    const result = chooseAgencyRoute(rules, { categoryId: CAT_POTHOLE, wardId: WARD_A, zoneId: ZONE_1 });
    expect(result.status).toBe("review_queue");
    expect([result.agencyId, ...result.candidates]).toEqual(expect.arrayContaining([GCC, HIGHWAYS]));
  });

  it("respects explicit priority overrides between otherwise-equal rules", () => {
    const rules: JurisdictionRule[] = [
      { agencyId: GCC, categoryId: CAT_POTHOLE, wardId: WARD_A, zoneId: null, priority: 0 },
      { agencyId: HIGHWAYS, categoryId: CAT_POTHOLE, wardId: WARD_A, zoneId: null, priority: 5 },
    ];
    const result = chooseAgencyRoute(rules, { categoryId: CAT_POTHOLE, wardId: WARD_A, zoneId: ZONE_1 });
    expect(result.agencyId).toBe(HIGHWAYS);
  });

  it("does not match a rule scoped to a different ward", () => {
    const rules: JurisdictionRule[] = [
      { agencyId: TANGEDCO, categoryId: CAT_STREETLIGHT, wardId: WARD_B, zoneId: null, priority: 0 },
    ];
    const result = chooseAgencyRoute(rules, { categoryId: CAT_STREETLIGHT, wardId: WARD_A, zoneId: ZONE_1 });
    expect(result.agencyId).toBeNull();
    expect(result.status).toBe("owner_unknown");
  });
});
