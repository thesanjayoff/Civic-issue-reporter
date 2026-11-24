import { describe, it, expect } from "vitest";
import { fuzzPoint, haversineDistanceM } from "@/lib/geo/point";

const CHENNAI_CENTRAL = { lon: 80.2707, lat: 13.0827 };

describe("haversineDistanceM", () => {
  it("is zero for the same point", () => {
    expect(haversineDistanceM(CHENNAI_CENTRAL, CHENNAI_CENTRAL)).toBe(0);
  });

  it("matches a known approximate distance (~1.1km for 0.01 deg lat at this latitude)", () => {
    const d = haversineDistanceM(CHENNAI_CENTRAL, { ...CHENNAI_CENTRAL, lat: CHENNAI_CENTRAL.lat + 0.01 });
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1200);
  });
});

describe("fuzzPoint", () => {
  it("keeps the fuzzed point within the configured radius band", () => {
    for (let i = 0; i < 200; i++) {
      const fuzzed = fuzzPoint(CHENNAI_CENTRAL, 120);
      const d = haversineDistanceM(CHENNAI_CENTRAL, fuzzed);
      expect(d).toBeGreaterThanOrEqual(120 * 0.4 - 1);
      expect(d).toBeLessThanOrEqual(120 + 1);
    }
  });

  it("never returns the exact original point", () => {
    const fuzzed = fuzzPoint(CHENNAI_CENTRAL, 120);
    expect(fuzzed).not.toEqual(CHENNAI_CENTRAL);
  });
});
