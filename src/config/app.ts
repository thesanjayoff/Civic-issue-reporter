/**
 * Single source of truth for the product name/brand. Change this to rename the
 * whole app — it is read by metadata, the PWA manifest, email/SMS templates,
 * and generated complaint text.
 */
export const APP_NAME = "Ooru Kural";
export const APP_NAME_TA = "ஊரு குரல்";
export const APP_TAGLINE_EN = "Chennai civic issue reporter & accountability tracker";
export const APP_TAGLINE_TA = "சென்னை குடிமை பிரச்சனை அறிக்கை மற்றும் பொறுப்புணர்வு கண்காணிப்பு";

export const APP_CITY = "Chennai";
export const DEFAULT_LOCALE = "en" as const;
export const SUPPORTED_LOCALES = ["en", "ta"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Centered roughly over Chennai; used as the default map viewport. */
export const DEFAULT_MAP_CENTER: [number, number] = [80.2707, 13.0827];
export const DEFAULT_MAP_ZOOM = 11;
