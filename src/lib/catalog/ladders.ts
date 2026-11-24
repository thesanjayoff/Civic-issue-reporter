import { ESCALATION_LADDER_ORDER, type EscalationStepKind } from "@/lib/escalation/templates";

export interface LadderStepDef {
  level: number;
  templateKey: EscalationStepKind;
  /** Hours after the previous step (or after the SLA deadline, for step 0) before this step unlocks. */
  waitHoursAfterPrevious: number;
  contactKey: string | null; // key into CONTACTS, resolved at seed time
}

export interface LadderDef {
  agencySlug: string;
  categorySlug: null; // demo ladders are agency-wide; a category-specific override is the same shape
  steps: LadderStepDef[];
}

function defaultSteps(contactKeyByLevel: Partial<Record<EscalationStepKind, string>>): LadderStepDef[] {
  const waits: Record<EscalationStepKind, number> = {
    reminder: 0,
    zonal: 72,
    regional: 168,
    state_grievance: 336,
    central_grievance: 336,
    rti: 504,
  };
  return ESCALATION_LADDER_ORDER.map((templateKey, i) => ({
    level: i + 1,
    templateKey,
    waitHoursAfterPrevious: waits[templateKey],
    contactKey: contactKeyByLevel[templateKey] ?? null,
  }));
}

export const LADDERS: LadderDef[] = [
  {
    agencySlug: "gcc",
    categorySlug: null,
    steps: defaultSteps({
      reminder: "gcc-1913",
      state_grievance: "tn-cm-helpline",
      central_grievance: "cpgrams",
      rti: "tn-rti",
    }),
  },
  {
    agencySlug: "cmwssb",
    categorySlug: null,
    steps: defaultSteps({
      reminder: "cmwssb-1916",
      state_grievance: "tn-cm-helpline",
      central_grievance: "cpgrams",
      rti: "tn-rti",
    }),
  },
  {
    agencySlug: "tangedco",
    categorySlug: null,
    steps: defaultSteps({
      reminder: "tangedco-1912",
      state_grievance: "tn-cm-helpline",
      central_grievance: "cpgrams",
      rti: "tn-rti",
    }),
  },
];
