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

// How one run went. Sources: docs/data/same_r.md §3, §4, §6, §7 (experiment table, telemetry, Final Report).
export const HOW: { title: string; text: string; cite: string }[] = [
  {
    title: "Heat a sample",
    text: "A small sample of a spacecraft material on a carousel was heated electrically. The heater level is set by its resistance ratio Rt/R0, not by a temperature.",
    cite: "Experimental table; HKP telemetry (HeatingInProgress)",
  },
  {
    title: "Age the smoke",
    text: "The smoke went into a well-mixed aging chamber. In some runs it was measured right away and again after aging (rows N and Na in the table).",
    cite: "Experimental table; Final Report p. 10",
  },
  {
    title: "Measure it",
    text: "Particle count (P-Trak), smoke mass (DustTrak) and smoke detectors (ISS light scatter and obscuration, Space Shuttle ionization, two ion detectors) were logged once per second.",
    cite: "HKP telemetry",
  },
  {
    title: "Catch particles",
    text: "In many runs a thermal precipitator caught particles on TEM grids. Back on Earth they were imaged under an electron microscope; particle sizes come from these images.",
    cite: "Final Report; TEM archives in Raw Data",
  },
];

// Columns of the experiment table. Source: docs/data/same_r.md §3 (Experimental table, PSI-101).
export const DICTIONARY: { field: string; meaning: string }[] = [
  { field: "Sample Type", meaning: "Material that was heated (Kapton, Silicone, Lampwick, Pyrell, Teflon)." },
  { field: "SAME Test #", meaning: "Test number. N and Na share the run: Na is the same smoke measured after aging." },
  { field: "Description", meaning: "Free-text notes, e.g. heater level, “no Ptrak”, “STS det”, “reburn”, “repeat”." },
  { field: "Date", meaning: "Date of the run in 2010." },
  { field: "Inlet velocity (cm/s)", meaning: "Inlet flow velocity, as recorded in the table." },
  { field: "Rt/R0", meaning: "Heater resistance ratio: a heating level (baseline / mid / high), not a temperature in °C." },
  { field: "Duration (sec)", meaning: "How long the sample was heated." },
  { field: "Primary aging / mixing time (sec)", meaning: "Aging and mixing times of the smoke, as recorded in the table." },
  { field: "Net aging time (sec)", meaning: "Total aging time of the smoke for an Na row." },
];
