/**
 * Demo routing rules. Real deployments would source these from each
 * agency's own published mandate/by-laws (see README). The one deliberately
 * contested rule below (missing_manhole_cover: both GCC storm drains and
 * CMWSSB sewage claim manholes) exists to exercise the "ownership
 * uncertain, let the user choose" path end to end.
 */

export interface JurisdictionRuleDef {
  agencySlug: string;
  categorySlug: string | null;
  wardSlug: string | null;
  zoneSlug: string | null;
  priority: number;
  notes: string;
}

export const JURISDICTION_RULES: JurisdictionRuleDef[] = [
  // Roads — GCC city-wide, with a ward-level highways override to demonstrate
  // that road ownership genuinely varies by stretch/ward in reality.
  { agencySlug: "gcc", categorySlug: "pothole", wardSlug: null, zoneSlug: null, priority: 0, notes: "Default: corporation-maintained roads." },
  { agencySlug: "gcc", categorySlug: "broken_road_edge", wardSlug: null, zoneSlug: null, priority: 0, notes: "Default: corporation-maintained roads." },
  { agencySlug: "gcc", categorySlug: "tree_fall_on_road", wardSlug: null, zoneSlug: null, priority: 0, notes: "Corporation handles road clearance." },
  { agencySlug: "highways", categorySlug: "pothole", wardSlug: "ward-demo-nandanam", zoneSlug: null, priority: 1, notes: "Demo: a state highway stretch runs through this ward and is Highways-owned, not GCC." },

  // Garbage / animals / encroachment — GCC.
  { agencySlug: "gcc", categorySlug: "garbage_not_collected", wardSlug: null, zoneSlug: null, priority: 0, notes: "Solid waste management is a corporation function." },
  { agencySlug: "gcc", categorySlug: "dead_animal", wardSlug: null, zoneSlug: null, priority: 0, notes: "Corporation conservancy." },
  { agencySlug: "gcc", categorySlug: "stray_dogs", wardSlug: null, zoneSlug: null, priority: 0, notes: "Corporation animal management wing." },
  { agencySlug: "gcc", categorySlug: "encroachment", wardSlug: null, zoneSlug: null, priority: 0, notes: "Corporation town planning / anti-encroachment." },
  { agencySlug: "gcc", categorySlug: "waterlogging", wardSlug: null, zoneSlug: null, priority: 0, notes: "Storm-water drainage is a corporation function in most areas." },
  { agencySlug: "gcc", categorySlug: "severe_flooding_danger", wardSlug: null, zoneSlug: null, priority: 0, notes: "Same as waterlogging; also routes to the emergency screen." },

  // Drains / sewage / water supply — CMWSSB, except the deliberately
  // contested manhole-cover category.
  { agencySlug: "cmwssb", categorySlug: "blocked_drain", wardSlug: null, zoneSlug: null, priority: 0, notes: "Underground sewerage network." },
  { agencySlug: "cmwssb", categorySlug: "sewage_overflow", wardSlug: null, zoneSlug: null, priority: 0, notes: "Sewerage network." },
  { agencySlug: "cmwssb", categorySlug: "open_manhole", wardSlug: null, zoneSlug: null, priority: 0, notes: "Also routes to the emergency screen regardless of agency." },
  { agencySlug: "cmwssb", categorySlug: "leaking_pipe", wardSlug: null, zoneSlug: null, priority: 0, notes: "Water distribution network." },
  { agencySlug: "cmwssb", categorySlug: "no_water_supply", wardSlug: null, zoneSlug: null, priority: 0, notes: "Water distribution network." },
  { agencySlug: "gcc", categorySlug: "missing_manhole_cover", wardSlug: null, zoneSlug: null, priority: 0, notes: "Contested on purpose: could be a storm-water (GCC) or sewage (CMWSSB) manhole — surfaced as a 'likely owners' choice." },
  { agencySlug: "cmwssb", categorySlug: "missing_manhole_cover", wardSlug: null, zoneSlug: null, priority: 0, notes: "Contested on purpose: see GCC rule above." },

  // Streetlights / power — TANGEDCO.
  { agencySlug: "tangedco", categorySlug: "streetlight_not_working", wardSlug: null, zoneSlug: null, priority: 0, notes: "Streetlight feeder network." },
  { agencySlug: "tangedco", categorySlug: "power_outage", wardSlug: null, zoneSlug: null, priority: 0, notes: "Distribution network." },
  { agencySlug: "tangedco", categorySlug: "hanging_wires", wardSlug: null, zoneSlug: null, priority: 0, notes: "Distribution network." },
  { agencySlug: "tangedco", categorySlug: "fallen_power_line", wardSlug: null, zoneSlug: null, priority: 0, notes: "Also routes to the emergency screen regardless of agency." },
];
