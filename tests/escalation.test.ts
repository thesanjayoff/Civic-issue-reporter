import { describe, it, expect } from "vitest";
import { buildEscalationMessage, ESCALATION_LADDER_ORDER } from "@/lib/escalation/templates";

const baseInput = {
  publicCode: "OK-AB12CD",
  categoryLabelEn: "Pothole",
  categoryLabelTa: "சாலைக் குழி",
  locationText: "Anna Salai, near bus stop",
  agencyNameEn: "Greater Chennai Corporation",
  agencyNameTa: "பெருநகர சென்னை மாநகராட்சி",
  officialReferenceNumber: "GCC-2026-00123",
  filedDate: "2026-01-01",
  overdueDays: 5,
  evidenceUrl: "https://example.org/r/OK-AB12CD",
};

describe("buildEscalationMessage", () => {
  it("builds every step in the ladder without throwing", () => {
    for (const step of ESCALATION_LADDER_ORDER) {
      const msg = buildEscalationMessage(step, baseInput);
      expect(msg.bodyEn.length).toBeGreaterThan(0);
      expect(msg.bodyTa.length).toBeGreaterThan(0);
    }
  });

  it("includes the official reference number and evidence link when present", () => {
    const msg = buildEscalationMessage("zonal", baseInput);
    expect(msg.bodyEn).toContain("GCC-2026-00123");
    expect(msg.bodyEn).toContain(baseInput.evidenceUrl);
  });

  it("never fabricates a reference number when none is logged", () => {
    const msg = buildEscalationMessage("reminder", { ...baseInput, officialReferenceNumber: null });
    expect(msg.bodyEn).toContain("No official reference number has been logged yet.");
  });

  it("RTI step requests the office, not an individual officer, by design", () => {
    const msg = buildEscalationMessage("rti", baseInput);
    expect(msg.bodyEn).toContain("not an individual officer's personal details");
  });

  it("never names or targets an individual person (no Mr./Mrs./Dr. honorifics in any template)", () => {
    for (const step of ESCALATION_LADDER_ORDER) {
      const msg = buildEscalationMessage(step, baseInput);
      expect(msg.bodyEn).not.toMatch(/\b(Mr|Mrs|Ms|Dr)\.\s/);
    }
  });
});
