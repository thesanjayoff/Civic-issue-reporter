export interface RateLimitRule {
  action: string;
  maxEvents: number;
  windowMinutes: number;
}

/** Pure decision given a count already fetched from storage — kept separate from the DB call so it's unit-testable. */
export function isWithinLimit(countInWindow: number, rule: RateLimitRule): boolean {
  return countInWindow < rule.maxEvents;
}

export const RATE_LIMIT_RULES = {
  createReport: { action: "create_report", maxEvents: 10, windowMinutes: 60 },
  addSupporter: { action: "add_supporter", maxEvents: 30, windowMinutes: 60 },
  flagModeration: { action: "flag_moderation", maxEvents: 20, windowMinutes: 60 },
  escalationSend: { action: "escalation_send", maxEvents: 15, windowMinutes: 60 },
} as const satisfies Record<string, RateLimitRule>;
