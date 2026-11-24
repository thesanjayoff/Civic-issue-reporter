/**
 * Agency catalog with explicit, dated verification status. "verified" means
 * a human (or the research pass in this repo's history) confirmed the fact
 * against the agency's own live page on sourceDate. Everything else is
 * "unverified" and MUST be displayed with a caveat, never as settled fact —
 * see README "Known limitations / data verification" before relying on any
 * of this in a real deployment.
 */

export type VerificationStatus = "verified" | "unverified" | "stale";

export interface AgencyDef {
  slug: string;
  nameEn: string;
  nameTa: string;
  kind: "corporation" | "water_sewage" | "electricity" | "highways" | "other";
  website: string;
  verificationStatus: VerificationStatus;
  sourceUrl: string | null;
  sourceDate: string | null; // ISO date
  notes: string;
}

export const AGENCIES: AgencyDef[] = [
  {
    slug: "gcc",
    nameEn: "Greater Chennai Corporation",
    nameTa: "பெருநகர சென்னை மாநகராட்சி",
    kind: "corporation",
    website: "https://www.chennaicorporation.gov.in",
    verificationStatus: "unverified",
    sourceUrl: "https://www.chennaicorporation.gov.in",
    sourceDate: "2026-11-24",
    notes:
      "Domain confirmed reachable; the 1913 complaint helpline and 'Namma Chennai' app are widely reported but were not confirmed directly on the corporation's own site in this pass — reconfirm before shipping.",
  },
  {
    slug: "cmwssb",
    nameEn: "Chennai Metropolitan Water Supply and Sewerage Board (Metro Water)",
    nameTa: "சென்னை பெருநகர குடிநீர் வழங்கல் மற்றும் கழிவுநீர் வாரியம்",
    kind: "water_sewage",
    website: "https://cmwssb.tn.gov.in",
    verificationStatus: "unverified",
    sourceUrl: "https://cmwssb.tn.gov.in/node/106",
    sourceDate: "2026-11-24",
    notes:
      "Official domain confirmed. A 1916 toll-free number and 14420 national helpline are referenced in board materials; third-party sites list conflicting numbers — reconfirm the live complaint number before shipping.",
  },
  {
    slug: "tangedco",
    nameEn: "Tamil Nadu Generation and Distribution Corporation (TANGEDCO)",
    nameTa: "தமிழ்நாடு உருவாக்கம் மற்றும் விநியோக கழகம் (TANGEDCO)",
    kind: "electricity",
    website: "https://www.tangedco.gov.in",
    verificationStatus: "unverified",
    sourceUrl: null,
    sourceDate: "2026-11-24",
    notes:
      "A 1912 outage/fault helpline is widely reported, but sources disagree on whether it requires a BSNL line or an STD prefix from other networks, and on whether Chennai distribution has since moved to a successor entity. Do not publish any number here without checking tangedco.gov.in directly first.",
  },
  {
    slug: "highways",
    nameEn: "Tamil Nadu Highways Department (Chennai region)",
    nameTa: "தமிழ்நாடு நெடுஞ்சாலைத் துறை (சென்னை பகுதி)",
    kind: "highways",
    website: "https://www.tnhighways.tn.gov.in",
    verificationStatus: "unverified",
    sourceUrl: null,
    sourceDate: "2026-11-24",
    notes:
      "Owns certain arterial/state highway stretches that pass through Chennai rather than the corporation. Included so road-category routing can demonstrate a real ownership split, not because a specific contact number has been confirmed.",
  },
];
