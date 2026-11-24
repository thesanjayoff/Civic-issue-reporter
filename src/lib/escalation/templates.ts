/**
 * Escalation message templates. Kept neutral and factual by construction —
 * no placeholder ever resolves to an individual official's name (principle:
 * "report issues, agencies, and timelines, never name or criticize staff").
 * Tamil copy here is functional civic-register Tamil; flag for native-speaker
 * review before real-world use (see README "Known limitations").
 */

export type EscalationStepKind =
  | "reminder"
  | "zonal"
  | "regional"
  | "state_grievance"
  | "central_grievance"
  | "rti";

export interface EscalationTemplateInput {
  publicCode: string;
  categoryLabelEn: string;
  categoryLabelTa: string;
  locationText: string;
  agencyNameEn: string;
  agencyNameTa: string;
  officialReferenceNumber: string | null;
  filedDate: string | null; // ISO date, already formatted by caller
  overdueDays: number | null;
  evidenceUrl: string;
}

export interface EscalationMessage {
  subjectEn: string;
  subjectTa: string;
  bodyEn: string;
  bodyTa: string;
}

function refLine(ref: string | null): { en: string; ta: string } {
  return ref
    ? { en: `Official reference number: ${ref}.`, ta: `அதிகாரப்பூர்வ குறிப்பு எண்: ${ref}.` }
    : { en: "No official reference number has been logged yet.", ta: "இதுவரை அதிகாரப்பூர்வ குறிப்பு எண் பதிவு செய்யப்படவில்லை." };
}

function overdueLine(days: number | null): { en: string; ta: string } {
  if (days === null) return { en: "", ta: "" };
  return {
    en: `This is ${Math.max(0, Math.round(days))} day(s) past the reported service-level target.`,
    ta: `இது அறிவிக்கப்பட்ட சேவை இலக்கு காலத்தை விட ${Math.max(0, Math.round(days))} நாட்கள் தாண்டியுள்ளது.`,
  };
}

export function buildEscalationMessage(
  step: EscalationStepKind,
  input: EscalationTemplateInput
): EscalationMessage {
  const ref = refLine(input.officialReferenceNumber);
  const overdue = overdueLine(input.overdueDays);
  const filed = input.filedDate ?? "date not recorded";

  const commonEn = [
    `Civic issue report ${input.publicCode}: ${input.categoryLabelEn} at ${input.locationText}.`,
    `Filed with ${input.agencyNameEn} on ${filed}.`,
    ref.en,
    overdue.en,
    `Evidence and timeline: ${input.evidenceUrl}`,
  ]
    .filter(Boolean)
    .join(" ");

  const commonTa = [
    `குடிமை பிரச்சனை அறிக்கை ${input.publicCode}: ${input.locationText}-ல் ${input.categoryLabelTa}.`,
    `${input.agencyNameTa}-இடம் ${filed}-ல் பதிவு செய்யப்பட்டது.`,
    ref.ta,
    overdue.ta,
    `ஆதாரம் மற்றும் காலவரிசை: ${input.evidenceUrl}`,
  ]
    .filter(Boolean)
    .join(" ");

  switch (step) {
    case "reminder":
      return {
        subjectEn: `Reminder: civic issue ${input.publicCode} is still open`,
        subjectTa: `நினைவூட்டல்: குடிமை பிரச்சனை ${input.publicCode} இன்னும் தீர்க்கப்படவில்லை`,
        bodyEn: `${commonEn} Requesting an update on the current status and expected action date.`,
        bodyTa: `${commonTa} தற்போதைய நிலை மற்றும் எதிர்பார்க்கப்படும் நடவடிக்கை தேதி பற்றிய புதுப்பிப்பு கோரப்படுகிறது.`,
      };
    case "zonal":
      return {
        subjectEn: `Escalation (zonal level): civic issue ${input.publicCode} overdue`,
        subjectTa: `அதிகரிப்பு (மண்டல நிலை): குடிமை பிரச்சனை ${input.publicCode} காலம் கடந்தது`,
        bodyEn: `${commonEn} This report has not been resolved within the reported target and is being escalated to the zonal office for review and action.`,
        bodyTa: `${commonTa} இந்த அறிக்கை அறிவிக்கப்பட்ட இலக்கு காலத்தில் தீர்க்கப்படாததால், மண்டல அலுவலகத்தின் பரிசீலனை மற்றும் நடவடிக்கைக்காக அதிகரிக்கப்படுகிறது.`,
      };
    case "regional":
      return {
        subjectEn: `Escalation (regional/senior officer level): civic issue ${input.publicCode}`,
        subjectTa: `அதிகரிப்பு (பிராந்திய/மேலதிகாரி நிலை): குடிமை பிரச்சனை ${input.publicCode}`,
        bodyEn: `${commonEn} Despite a zonal-level reminder, this report remains unresolved. Escalating for senior-officer attention.`,
        bodyTa: `${commonTa} மண்டல நிலை நினைவூட்டல் அனுப்பப்பட்ட பிறகும், இந்த அறிக்கை தீர்க்கப்படாமல் உள்ளது. மேலதிகாரியின் கவனத்திற்காக அதிகரிக்கப்படுகிறது.`,
      };
    case "state_grievance":
      return {
        subjectEn: `Grievance submission: civic issue ${input.publicCode}`,
        subjectTa: `குறை தீர்வு மனு: குடிமை பிரச்சனை ${input.publicCode}`,
        bodyEn: `${commonEn} Submitting this unresolved civic issue to the state public grievance redressal mechanism for independent review.`,
        bodyTa: `${commonTa} இந்த தீர்க்கப்படாத குடிமை பிரச்சனையை மாநில பொது குறை தீர்வு வழிமுறையில் சுயாதீன பரிசீலனைக்காக சமர்ப்பிக்கிறோம்.`,
      };
    case "central_grievance":
      return {
        subjectEn: `Grievance submission (CPGRAMS): civic issue ${input.publicCode}`,
        subjectTa: `குறை தீர்வு மனு (CPGRAMS): குடிமை பிரச்சனை ${input.publicCode}`,
        bodyEn: `${commonEn} Submitting via the central public grievance portal (CPGRAMS) as state-level escalation has not resolved this issue.`,
        bodyTa: `${commonTa} மாநில அளவிலான அதிகரிப்பு இந்த பிரச்சனையை தீர்க்காததால், மத்திய பொது குறை தீர்வு போர்ட்டல் (CPGRAMS) மூலம் சமர்ப்பிக்கிறோம்.`,
      };
    case "rti":
      return {
        subjectEn: `RTI request: status and action taken on civic issue ${input.publicCode}`,
        subjectTa: `தகவல் அறியும் உரிமை (RTI) கோரிக்கை: குடிமை பிரச்சனை ${input.publicCode} குறித்த நிலை மற்றும் நடவடிக்கை`,
        bodyEn: `Under the Right to Information Act, 2005, requesting: (1) the current status of the civic issue reported as ${input.publicCode}${input.officialReferenceNumber ? ` (reference ${input.officialReferenceNumber})` : ""}; (2) copies of any inspection or action-taken reports; (3) the name/designation of the office presently responsible for action, not an individual officer's personal details. ${overdue.en} Evidence and timeline: ${input.evidenceUrl}`,
        bodyTa: `தகவல் அறியும் உரிமை சட்டம், 2005-ன் கீழ், பின்வருவனவற்றைக் கோருகிறேன்: (1) ${input.publicCode}${input.officialReferenceNumber ? ` (குறிப்பு ${input.officialReferenceNumber})` : ""} எனப் பதிவு செய்யப்பட்ட குடிமை பிரச்சனையின் தற்போதைய நிலை; (2) ஏதேனும் ஆய்வு அல்லது நடவடிக்கை அறிக்கைகளின் நகல்கள்; (3) தற்போது நடவடிக்கைக்குப் பொறுப்பான அலுவலகத்தின் பெயர்/பதவி விவரம் (தனிப்பட்ட அதிகாரி விவரங்கள் அல்ல). ${overdue.ta} ஆதாரம் மற்றும் காலவரிசை: ${input.evidenceUrl}`,
      };
  }
}

export const ESCALATION_LADDER_ORDER: EscalationStepKind[] = [
  "reminder",
  "zonal",
  "regional",
  "state_grievance",
  "central_grievance",
  "rti",
];
