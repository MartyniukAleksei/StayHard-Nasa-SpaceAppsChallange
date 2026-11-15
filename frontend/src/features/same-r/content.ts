// Curated text for the SAME-R pages. No statistics here: every count on the page comes from the API.
// Ref ids point into refs.ts (verified sources); see docs/data/same_r.md for the data behind the notes.

export const HERO_QUESTION = "Would a smoke detector built for Earth notice a fire in space?";

export const HERO_LEDE =
  "Spacecraft materials were heated aboard the ISS until they smoked. The smoke was aged in a chamber, then pushed past smoke detectors and particle counters.";

export type Note = { text: string; refs: string[] };

// "Tests to read first": notes per pick id (lib/picks.ts). They say what to look for and cite a source;
// numbers next to the charts are computed from the data on the page.
export const CARD_NOTES: Record<string, Note[]> = {
  aged: [
    {
      text: "The table has two rows for this run: N, measured right away, and Na, the same smoke measured after it aged in the chamber. Each row's aging time is in the tests table.",
      refs: ["psi101"],
    },
    {
      text: "In the baseline runs aged smoke had substantially larger particle diameters than fresh smoke: as smoke ages, particles collide and join.",
      refs: ["fr"],
    },
    {
      text: "The charts show count and mass, not size. Mean diameters are computed by combining such moments, so any size read from them is derived.",
      refs: ["meyer15"],
    },
  ],
  tem: [
    {
      text: "A thermal precipitator caught smoke particles from this run on TEM grids. They were imaged back on Earth; the microscope gives particle size distributions.",
      refs: ["fr", "meyer15"],
    },
    {
      text: "On the first flight (SAME) the TEM grids were contaminated with extraneous particles. SAME-R used stricter assembly controls and gave many good particle images.",
      refs: ["fr"],
    },
    { text: "The telemetry has no size: only count (P-Trak) and mass (DustTrak). Open the test to see the TEM images.", refs: ["psi101"] },
  ],
  limit: [
    {
      text: "The P-Trak counter reads at most 500,000 particles/cm³. Points at that value are lower bounds: the true count was at least this high.",
      refs: ["psi101"],
    },
    {
      text: "Heater levels were chosen to give a reasonable signal without saturating the instruments. When a reading still reaches the limit, the time of the flat top is not the time of the peak.",
      refs: ["fr"],
    },
  ],
  sts: [
    {
      text: "In the later runs the Space Shuttle (STS) ionization detector flew next to the ISS light-scattering detector, so both saw the same smoke.",
      refs: ["psi101", "meyer13"],
    },
    {
      text: "Earlier shuttle experiments found that the relative performance of the ISS and shuttle detectors changes in low gravity.",
      refs: ["urban07"],
    },
    {
      text: "Small particles, such as Kapton and Teflon smoke, give weak light-scattering signals; the large particles of lampwick and silicone smoke give very large ones.",
      refs: ["fr"],
    },
  ],
};

export type Finding = {
  id: "scatter" | "mass";
  /** test numbers shown together; all three are "Baseline STS det" runs with similar particle counts */
  tests: number[];
  evidence: "measured" | "derived";
  claim: string;
  caveat: string;
  refs: string[];
};

export const FINDINGS: Finding[] = [
  {
    id: "scatter",
    tests: [89, 92, 88],
    evidence: "measured",
    claim: "The ISS light-scattering detector responded far less to Teflon and Kapton smoke than to lampwick smoke.",
    caveat:
      "Particle counts differ a little between the runs (see the caption). The lampwick trace sits at the lowest level the channel recorded in any run, so its true response may be larger. Alarm settings in volts are not in the data.",
    refs: ["fr", "meyer13"],
  },
  {
    id: "mass",
    tests: [89, 92, 88],
    evidence: "derived",
    claim: "At similar particle counts, Teflon and Kapton smoke carried far less mass than lampwick smoke: their particles were much smaller.",
    caveat:
      "Mass (DustTrak B) and count (P-Trak) peak at different seconds, so a size computed from the two peaks is a rough estimate. Measured diameters per material are in the Final Report, Table 1.",
    refs: ["fr", "meyer15"],
  },
];

export const TRAPS: string[] = [
  "Rt/R0 is the heater resistance ratio, a heating level, not a temperature in °C.",
  "P-Trak counts saturate at its upper limit: a reading at the limit means “at least”.",
  "The detector set changed between runs; only detectors that were active in a test are shown.",
  "The telemetry has particle count and mass, not particle size. Size distributions come from TEM images in the Final Report.",
];

// How one run went. Sources: docs/data/same_r.md §3, §4, §6, §7 (experiment table, telemetry, Final Report).
export const HOW: { title: string; text: string; refs: string[] }[] = [
  {
    title: "Heat a sample",
    text: "A small sample of a spacecraft material on a carousel was heated electrically for about 60 s. The heater level is set by its resistance ratio Rt/R0, not by a temperature.",
    refs: ["psi101", "fr"],
  },
  {
    title: "Age the smoke",
    text: "The smoke went into an aging chamber. In some runs it was measured right away and again after aging (rows N and Na in the table).",
    refs: ["psi101"],
  },
  {
    title: "Measure it",
    text: "Particle count (P-Trak), smoke mass (DustTrak) and smoke detectors (ISS light scatter and obscuration, Space Shuttle ionization, two ion detectors) were logged once per second.",
    refs: ["psi101"],
  },
  {
    title: "Catch particles",
    text: "In many runs a thermal precipitator caught particles on TEM grids. Back on Earth they were imaged under an electron microscope, which gives particle size distributions.",
    refs: ["fr", "meyer15"],
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
