// Curated text for the SAME-R pages. No statistics here: every count on the page comes from the API.
// Sources: docs/data/same_r.md §1 and §7 (Final Report p. 5; SAME-2 comparison slides 28–29).

export const HERO_QUESTION = "Would a smoke detector built for Earth notice a fire in space?";

export const HERO_LEDE =
  "Spacecraft materials were heated aboard the ISS until they smoked. The smoke was aged in a chamber, then pushed past smoke detectors and particle counters.";

export const WHY: { title: string; text: string; cite: string }[] = [
  {
    title: "No buoyancy, different smoke",
    text: "Without gravity, smoke stays near its source longer and particles grow differently, so their sizes differ from smoke on Earth.",
    cite: "SAME-R Final Report",
  },
  {
    title: "Small particles slip past",
    text: "The ISS light-scattering detector responded less to the fine smoke of Kapton and Teflon; the ionization (STS) detector did somewhat better.",
    cite: "SAME-2 comparison slides 28–29; Final Report p. 5",
  },
  {
    title: "No single detector fits all",
    text: "A detector that responds to fine smoke and ignores large dust needs to tell particle sizes apart.",
    cite: "SAME-R Final Report p. 5",
  },
];

export const TRAPS: string[] = [
  "Rt/R0 is the heater resistance ratio, a heating level, not a temperature in °C.",
  "P-Trak counts saturate at its upper limit: a reading at the limit means “at least”.",
  "The detector set changed between runs; only detectors that were active in a test are shown.",
  "The telemetry has particle count and mass, not particle size. Size distributions come from TEM images in the Final Report.",
];
