/**
 * SLA ("service-level") clocks. Per the product principles these are
 * published-or-reported *targets*, not legal guarantees — every caller must
 * carry isPublished/sourceLabel through to the UI so it never reads as a
 * promise.
 */

export interface SlaTarget {
  targetHours: number;
  isPublished: boolean;
  sourceLabel: string;
}

export interface SlaClockState {
  deadline: Date;
  hoursRemaining: number;
  isOverdue: boolean;
  /** Fraction of the window elapsed, clamped to [0, 1.5] for progress bars. */
  elapsedFraction: number;
}

/** The clock starts when the official reference number is logged, not at report time. */
export function computeSlaDeadline(officialFiledAt: Date, target: SlaTarget): Date {
  return new Date(officialFiledAt.getTime() + target.targetHours * 60 * 60 * 1000);
}

export function evaluateSlaClock(
  officialFiledAt: Date,
  target: SlaTarget,
  now: Date = new Date()
): SlaClockState {
  const deadline = computeSlaDeadline(officialFiledAt, target);
  const totalMs = target.targetHours * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - officialFiledAt.getTime();
  const remainingMs = deadline.getTime() - now.getTime();

  return {
    deadline,
    hoursRemaining: remainingMs / (60 * 60 * 1000),
    isOverdue: remainingMs < 0,
    elapsedFraction: totalMs > 0 ? Math.max(0, elapsedMs / totalMs) : 0,
  };
}

export type ReminderTier = "none" | "approaching" | "due_soon" | "overdue";

/**
 * Reminder cadence: nudge at 50% elapsed, again when <24h remain, and once
 * overdue. Kept as a pure function so notification scheduling can be tested
 * without wall-clock timers.
 */
export function reminderTier(state: SlaClockState): ReminderTier {
  if (state.isOverdue) return "overdue";
  if (state.hoursRemaining <= 24) return "due_soon";
  if (state.elapsedFraction >= 0.5) return "approaching";
  return "none";
}
