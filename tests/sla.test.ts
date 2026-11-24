import { describe, it, expect } from "vitest";
import { computeSlaDeadline, evaluateSlaClock, reminderTier } from "@/lib/sla/clock";

const target = { targetHours: 72, isPublished: true, sourceLabel: "GCC published guideline (2026)" };

describe("SLA clock", () => {
  it("computes the deadline relative to the official filed date, not the report date", () => {
    const filedAt = new Date("2026-01-01T00:00:00Z");
    const deadline = computeSlaDeadline(filedAt, target);
    expect(deadline.toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });

  it("is not overdue before the deadline", () => {
    const filedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-02T00:00:00Z");
    const state = evaluateSlaClock(filedAt, target, now);
    expect(state.isOverdue).toBe(false);
    expect(state.hoursRemaining).toBeCloseTo(48, 0);
  });

  it("is overdue after the deadline", () => {
    const filedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-05T00:00:00Z");
    const state = evaluateSlaClock(filedAt, target, now);
    expect(state.isOverdue).toBe(true);
    expect(state.hoursRemaining).toBeLessThan(0);
  });

  it("reminder tiers escalate as the deadline approaches and passes", () => {
    const filedAt = new Date("2026-01-01T00:00:00Z");

    const early = evaluateSlaClock(filedAt, target, new Date("2026-01-01T10:00:00Z"));
    expect(reminderTier(early)).toBe("none");

    const halfway = evaluateSlaClock(filedAt, target, new Date("2026-01-02T13:00:00Z"));
    expect(reminderTier(halfway)).toBe("approaching");

    const dueSoon = evaluateSlaClock(filedAt, target, new Date("2026-01-03T06:00:00Z"));
    expect(reminderTier(dueSoon)).toBe("due_soon");

    const overdue = evaluateSlaClock(filedAt, target, new Date("2026-01-05T00:00:00Z"));
    expect(reminderTier(overdue)).toBe("overdue");
  });
});
