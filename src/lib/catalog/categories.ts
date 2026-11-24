/**
 * Canonical category catalog. This is a static TS module (not a DB table
 * read) on purpose: the offline report-capture flow must be able to show
 * category choices with zero network access, and the seed script imports
 * this same array as its source of truth so the DB and the client never
 * drift apart.
 */

export interface CategoryDef {
  slug: string;
  parentSlug: string | null;
  nameEn: string;
  nameTa: string;
  icon: string;
  isEmergency: boolean;
  /** Shown on the emergency screen for is_emergency categories. */
  emergencyNoteEn?: string;
  emergencyNoteTa?: string;
  defaultAgencyKind: "corporation" | "water_sewage" | "electricity" | "highways" | "other" | null;
  defaultSlaHours: number;
}

export const CATEGORIES: CategoryDef[] = [
  // --- Roads ---
  { slug: "road", parentSlug: null, nameEn: "Roads", nameTa: "சாலைகள்", icon: "road", isEmergency: false, defaultAgencyKind: "corporation", defaultSlaHours: 168 },
  { slug: "pothole", parentSlug: "road", nameEn: "Pothole", nameTa: "சாலைக் குழி", icon: "road", isEmergency: false, defaultAgencyKind: "corporation", defaultSlaHours: 168 },
  { slug: "broken_road_edge", parentSlug: "road", nameEn: "Broken road edge", nameTa: "சாலை ஓரம் உடைந்தது", icon: "road", isEmergency: false, defaultAgencyKind: "corporation", defaultSlaHours: 168 },
  { slug: "tree_fall_on_road", parentSlug: "road", nameEn: "Tree fallen on road", nameTa: "சாலையில் மரம் விழுந்துள்ளது", icon: "alert-triangle", isEmergency: true, emergencyNoteEn: "If the tree is blocking traffic or near power lines, treat this as an emergency.", emergencyNoteTa: "மரம் போக்குவரத்தை தடுக்கிறது அல்லது மின் கம்பிகளுக்கு அருகில் இருந்தால், இதை அவசரநிலையாகக் கருதவும்.", defaultAgencyKind: "corporation", defaultSlaHours: 6 },

  // --- Streetlights ---
  { slug: "streetlight", parentSlug: null, nameEn: "Streetlights", nameTa: "தெரு விளக்குகள்", icon: "lightbulb", isEmergency: false, defaultAgencyKind: "electricity", defaultSlaHours: 24 },
  { slug: "streetlight_not_working", parentSlug: "streetlight", nameEn: "Streetlight not working", nameTa: "தெரு விளக்கு வேலை செய்யவில்லை", icon: "lightbulb", isEmergency: false, defaultAgencyKind: "electricity", defaultSlaHours: 24 },

  // --- Garbage ---
  { slug: "garbage", parentSlug: null, nameEn: "Garbage", nameTa: "குப்பை", icon: "trash", isEmergency: false, defaultAgencyKind: "corporation", defaultSlaHours: 48 },
  { slug: "garbage_not_collected", parentSlug: "garbage", nameEn: "Garbage not collected", nameTa: "குப்பை அகற்றப்படவில்லை", icon: "trash", isEmergency: false, defaultAgencyKind: "corporation", defaultSlaHours: 48 },
  { slug: "dead_animal", parentSlug: "garbage", nameEn: "Dead animal", nameTa: "இறந்த விலங்கு", icon: "trash", isEmergency: false, defaultAgencyKind: "corporation", defaultSlaHours: 24 },

  // --- Drainage / water on streets ---
  { slug: "drainage", parentSlug: null, nameEn: "Drains & manholes", nameTa: "வாய்க்கால் மற்றும் மேன்ஹோல்", icon: "droplets", isEmergency: false, defaultAgencyKind: "water_sewage", defaultSlaHours: 72 },
  { slug: "waterlogging", parentSlug: "drainage", nameEn: "Waterlogging", nameTa: "தண்ணீர் தேக்கம்", icon: "droplets", isEmergency: false, defaultAgencyKind: "corporation", defaultSlaHours: 48 },
  { slug: "severe_flooding_danger", parentSlug: "drainage", nameEn: "Severe flooding — danger to life", nameTa: "கடுமையான வெள்ளம் — உயிருக்கு ஆபத்து", icon: "alert-triangle", isEmergency: true, emergencyNoteEn: "Deep or fast-moving floodwater is life-threatening. Do not walk or drive through it.", emergencyNoteTa: "ஆழமான அல்லது வேகமாக ஓடும் வெள்ள நீர் உயிருக்கு ஆபத்தானது. அதில் நடக்கவோ வாகனம் ஓட்டவோ வேண்டாம்.", defaultAgencyKind: "corporation", defaultSlaHours: 2 },
  { slug: "blocked_drain", parentSlug: "drainage", nameEn: "Blocked drain", nameTa: "அடைபட்ட வாய்க்கால்", icon: "droplets", isEmergency: false, defaultAgencyKind: "water_sewage", defaultSlaHours: 72 },
  { slug: "missing_manhole_cover", parentSlug: "drainage", nameEn: "Missing manhole cover", nameTa: "மேன்ஹோல் மூடி இல்லை", icon: "alert-triangle", isEmergency: false, defaultAgencyKind: "water_sewage", defaultSlaHours: 24 },
  { slug: "open_manhole", parentSlug: "drainage", nameEn: "Open manhole — danger to life", nameTa: "திறந்த மேன்ஹோல் — உயிருக்கு ஆபத்து", icon: "alert-triangle", isEmergency: true, emergencyNoteEn: "An open manhole is a serious fall hazard, especially in the dark or during rain.", emergencyNoteTa: "திறந்த மேன்ஹோல் குறிப்பாக இருட்டில் அல்லது மழையில் விழும் ஆபத்தை ஏற்படுத்தும்.", defaultAgencyKind: "water_sewage", defaultSlaHours: 2 },
  { slug: "sewage_overflow", parentSlug: "drainage", nameEn: "Sewage overflow", nameTa: "கழிவுநீர் வெளியேறுதல்", icon: "droplets", isEmergency: false, defaultAgencyKind: "water_sewage", defaultSlaHours: 24 },

  // --- Animals ---
  { slug: "animals", parentSlug: null, nameEn: "Animals", nameTa: "விலங்குகள்", icon: "paw-print", isEmergency: false, defaultAgencyKind: "corporation", defaultSlaHours: 168 },
  { slug: "stray_dogs", parentSlug: "animals", nameEn: "Stray dogs", nameTa: "தெரு நாய்கள்", icon: "paw-print", isEmergency: false, defaultAgencyKind: "corporation", defaultSlaHours: 168 },

  // --- Encroachment ---
  { slug: "encroachment", parentSlug: null, nameEn: "Encroachment", nameTa: "ஆக்கிரமிப்பு", icon: "map-pin-off", isEmergency: false, defaultAgencyKind: "corporation", defaultSlaHours: 336 },

  // --- Water supply ---
  { slug: "water_supply", parentSlug: null, nameEn: "Water supply", nameTa: "குடிநீர் வழங்கல்", icon: "droplets", isEmergency: false, defaultAgencyKind: "water_sewage", defaultSlaHours: 48 },
  { slug: "leaking_pipe", parentSlug: "water_supply", nameEn: "Leaking pipe", nameTa: "குழாய் கசிவு", icon: "droplets", isEmergency: false, defaultAgencyKind: "water_sewage", defaultSlaHours: 48 },
  { slug: "no_water_supply", parentSlug: "water_supply", nameEn: "No water supply", nameTa: "குடிநீர் வரவில்லை", icon: "droplets", isEmergency: false, defaultAgencyKind: "water_sewage", defaultSlaHours: 24 },

  // --- Power ---
  { slug: "power", parentSlug: null, nameEn: "Power", nameTa: "மின்சாரம்", icon: "zap", isEmergency: false, defaultAgencyKind: "electricity", defaultSlaHours: 24 },
  { slug: "power_outage", parentSlug: "power", nameEn: "Power outage", nameTa: "மின் தடை", icon: "zap", isEmergency: false, defaultAgencyKind: "electricity", defaultSlaHours: 24 },
  { slug: "hanging_wires", parentSlug: "power", nameEn: "Hanging/loose wires", nameTa: "தொங்கும் மின் கம்பிகள்", icon: "zap", isEmergency: false, defaultAgencyKind: "electricity", defaultSlaHours: 24 },
  { slug: "fallen_power_line", parentSlug: "power", nameEn: "Fallen power line — danger to life", nameTa: "விழுந்த மின் கம்பி — உயிருக்கு ஆபத்து", icon: "alert-triangle", isEmergency: true, emergencyNoteEn: "Stay well away from any downed power line and keep others away — assume it is live.", emergencyNoteTa: "விழுந்த மின் கம்பியிலிருந்து தொலைவில் இருங்கள், மற்றவர்களையும் தொலைவில் வையுங்கள் — அது உயிருடன் (live) இருக்கலாம் என்று கருதுங்கள்.", defaultAgencyKind: "electricity", defaultSlaHours: 2 },

  // --- Gas ---
  { slug: "gas_leak", parentSlug: null, nameEn: "Gas smell / suspected leak — danger to life", nameTa: "எரிவாயு வாசனை / கசிவு சந்தேகம் — உயிருக்கு ஆபத்து", icon: "alert-triangle", isEmergency: true, emergencyNoteEn: "Do not switch on lights or flames. Ventilate if safe, leave the area, and call for help from outside.", emergencyNoteTa: "விளக்கு அல்லது தீயை இயக்க வேண்டாம். பாதுகாப்பாக இருந்தால் காற்றோட்டம் செய்து, இடத்தை விட்டு வெளியேறி, வெளியே இருந்து உதவி கேளுங்கள்.", defaultAgencyKind: "other", defaultSlaHours: 1 },
];

export function isEmergencyCategory(slug: string): boolean {
  return CATEGORIES.find((c) => c.slug === slug)?.isEmergency ?? false;
}

export function topLevelCategories(): CategoryDef[] {
  return CATEGORIES.filter((c) => c.parentSlug === null);
}

export function subcategoriesOf(parentSlug: string): CategoryDef[] {
  return CATEGORIES.filter((c) => c.parentSlug === parentSlug);
}
