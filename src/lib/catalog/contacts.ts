/**
 * Escalation/emergency contacts. Only entries with verificationStatus
 * "verified" are safe to surface on the emergency "call now" screen as a
 * confident recommendation — everything else must render with a visible
 * "unverified, confirm locally" caveat. See the research notes this was
 * built from in README "Known limitations / data verification".
 */
import type { VerificationStatus } from "./agencies";

export interface ContactDef {
  key: string;
  agencySlug: string | null; // null = not agency-specific (e.g. national emergency number)
  labelEn: string;
  labelTa: string;
  kind: "phone" | "email" | "portal" | "app" | "rti";
  value: string;
  verificationStatus: VerificationStatus;
  sourceUrl: string | null;
  sourceDate: string;
  checkedBy: string;
}

export const CONTACTS: ContactDef[] = [
  {
    key: "erss-112",
    agencySlug: null,
    labelEn: "National Emergency Number (police / fire / ambulance)",
    labelTa: "தேசிய அவசரகால எண் (காவல் / தீயணைப்பு / ஆம்புலன்ஸ்)",
    kind: "phone",
    value: "112",
    verificationStatus: "verified",
    sourceUrl: "https://112.gov.in/faq",
    sourceDate: "2026-11-24",
    checkedBy: "research-pass-2026-11-24",
  },
  {
    key: "police-100",
    agencySlug: null,
    labelEn: "Police (direct line)",
    labelTa: "காவல்துறை (நேரடி எண்)",
    kind: "phone",
    value: "100",
    verificationStatus: "verified",
    sourceUrl: "https://incredibleindia.gov.in/en/emergency",
    sourceDate: "2026-11-24",
    checkedBy: "research-pass-2026-11-24",
  },
  {
    key: "fire-101",
    agencySlug: null,
    labelEn: "Fire service (direct line)",
    labelTa: "தீயணைப்பு சேவை (நேரடி எண்)",
    kind: "phone",
    value: "101",
    verificationStatus: "verified",
    sourceUrl: "https://incredibleindia.gov.in/en/emergency",
    sourceDate: "2026-11-24",
    checkedBy: "research-pass-2026-11-24",
  },
  {
    key: "ambulance-108",
    agencySlug: null,
    labelEn: "Ambulance (direct line)",
    labelTa: "ஆம்புலன்ஸ் (நேரடி எண்)",
    kind: "phone",
    value: "108",
    verificationStatus: "verified",
    sourceUrl: "https://incredibleindia.gov.in/en/emergency",
    sourceDate: "2026-11-24",
    checkedBy: "research-pass-2026-11-24",
  },
  {
    key: "cpgrams",
    agencySlug: null,
    labelEn: "Central Public Grievance Redress (CPGRAMS)",
    labelTa: "மத்திய பொது குறை தீர்வு (CPGRAMS)",
    kind: "portal",
    value: "https://pgportal.gov.in/Home/",
    verificationStatus: "verified",
    sourceUrl: "https://pgportal.gov.in/Home/",
    sourceDate: "2026-11-24",
    checkedBy: "research-pass-2026-11-24",
  },
  {
    key: "tn-rti",
    agencySlug: null,
    labelEn: "Tamil Nadu RTI Online portal",
    labelTa: "தமிழ்நாடு RTI ஆன்லைன் போர்ட்டல்",
    kind: "rti",
    value: "https://www.rtionline.tn.gov.in",
    verificationStatus: "verified",
    sourceUrl: "https://www.rtionline.tn.gov.in/guidelines.php",
    sourceDate: "2026-11-24",
    checkedBy: "research-pass-2026-11-24",
  },
  {
    key: "gcc-1913",
    agencySlug: "gcc",
    labelEn: "GCC civic complaint helpline (reported, unconfirmed)",
    labelTa: "GCC குடிமை புகார் உதவி எண் (தெரிவிக்கப்பட்டது, உறுதிப்படுத்தப்படவில்லை)",
    kind: "phone",
    value: "1913",
    verificationStatus: "unverified",
    sourceUrl: "https://www.thecurrentindia.com/govt/chennai-corporation-complaint-number",
    sourceDate: "2026-11-24",
    checkedBy: "research-pass-2026-11-24 (third-party source only)",
  },
  {
    key: "cmwssb-1916",
    agencySlug: "cmwssb",
    labelEn: "Metro Water complaint helpline (reported, unconfirmed)",
    labelTa: "மெட்ரோ வாட்டர் புகார் உதவி எண் (தெரிவிக்கப்பட்டது, உறுதிப்படுத்தப்படவில்லை)",
    kind: "phone",
    value: "1916",
    verificationStatus: "unverified",
    sourceUrl: "https://cmwssb.tn.gov.in/node/106",
    sourceDate: "2026-11-24",
    checkedBy: "research-pass-2026-11-24",
  },
  {
    key: "tangedco-1912",
    agencySlug: "tangedco",
    labelEn: "TANGEDCO outage/fault helpline (reported, unconfirmed)",
    labelTa: "TANGEDCO மின் தடை/கோளாறு உதவி எண் (தெரிவிக்கப்பட்டது, உறுதிப்படுத்தப்படவில்லை)",
    kind: "phone",
    value: "1912",
    verificationStatus: "unverified",
    sourceUrl: null,
    sourceDate: "2026-11-24",
    checkedBy: "research-pass-2026-11-24 (conflicting third-party sources, no official confirmation)",
  },
  {
    key: "tn-cm-helpline",
    agencySlug: null,
    labelEn: "Tamil Nadu CM public grievance helpline (reported, unconfirmed URL)",
    labelTa: "தமிழ்நாடு முதலமைச்சர் பொது குறை தீர்வு உதவி (தெரிவிக்கப்பட்டது, URL உறுதிப்படுத்தப்படவில்லை)",
    kind: "portal",
    value: "",
    verificationStatus: "unverified",
    sourceUrl: "https://citizen.complainthub.org/t/how-can-you-file-complaints-about-government-offices-to-tamil-nadu-public-grievance-cm-helpline-management-system-iipgcms/1955",
    sourceDate: "2026-11-24",
    checkedBy: "research-pass-2026-11-24 (no direct tn.gov.in URL confirmed; value left blank on purpose)",
  },
];

export function verifiedContacts(): ContactDef[] {
  return CONTACTS.filter((c) => c.verificationStatus === "verified");
}
