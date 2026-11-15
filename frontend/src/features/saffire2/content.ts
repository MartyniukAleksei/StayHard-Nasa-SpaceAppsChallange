// Curated copy for the Saffire-II dashboard. No statistics here: every number on the page
// comes from the API. Sample ids below (2-1 … 2-9) are citations, not counts.
import type { Verdict } from "./types";

export const HERO_QUESTION =
  "Does the Earth flammability test predict how a material burns in space?";

export const HERO_CONTEXT =
  "Samples the size of the NASA-STD-6001 Test 1 coupon were burned one by one in a flow duct aboard the uncrewed Cygnus cargo ship after it left the ISS. The same materials were also burned upward on Earth (1g).";

export const VERDICT_LABEL: Record<Verdict, string> = {
  earth_stricter: "1g test stricter",
  match: "same outcome",
  earth_weaker: "1g test milder",
  not_comparable: "not comparable",
  unknown: "no data",
};

export const VERDICT_HELP =
  "Verdict compares the burned length in microgravity (µg) with the 1g upward test. ‘1g test stricter’ means the Earth test burned more, so it errs on the safe side.";

export const PHYSICS = [
  {
    title: "No buoyancy, only the fan",
    body: "On Earth hot gas rises and feeds fresh oxygen to the flame. In microgravity nothing rises: the flame lives only on the forced air flow through the duct.",
  },
  {
    title: "Concurrent vs opposed",
    body: "Concurrent: air blows the same way the flame spreads and preheats the fuel ahead (the dangerous case, like burning upward on Earth). Opposed: the flame creeps against the wind.",
  },
  {
    title: "What the sensors see",
    body: "Thermocouples on the sample show the flame front passing; CO₂ shows how much burned; radiometers show heat radiated by the flame.",
  },
];

export type ComparePreset = {
  id: string;
  title: string;
  ids: string[];
  question: string;
};

export const COMPARE_PRESETS: ComparePreset[] = [
  {
    id: "thickness",
    title: "Thickness",
    ids: ["2-1", "2-2", "2-3"],
    question: "Silicone of three thicknesses, all in concurrent flow.",
  },
  {
    id: "direction",
    title: "Flow direction",
    ids: ["2-1", "2-4"],
    question: "Silicone in concurrent (2-1) and opposed (2-4) flow.",
  },
  {
    id: "fabric-plastic",
    title: "Fabric vs plastic",
    ids: ["2-5", "2-6", "2-8", "2-9"],
    question: "SIBAL cotton-fiberglass fabric against thick PMMA.",
  },
  {
    id: "pmma",
    title: "Thin vs thick PMMA",
    ids: ["2-7", "2-8", "2-9"],
    question: "The thin PMMA strip of 2-7 against the thick PMMA samples.",
  },
  {
    id: "repeat",
    title: "SIBAL repeat",
    ids: ["2-5", "2-6"],
    question: "Two identical SIBAL samples. Note the higher duct flow during 2-6.",
  },
];

export type Signal = "peak_t" | "co2_rise" | "radiometer";

export const SIGNALS: { id: Signal; label: string; unit: string }[] = [
  { id: "peak_t", label: "Hottest sample thermocouple", unit: "°C" },
  { id: "co2_rise", label: "CO₂ rise since ignition", unit: "ppm" },
  { id: "radiometer", label: "Radiometer 1, baseline removed", unit: "mW/cm²" },
];

export const TRAPS = [
  {
    title: "Radiometers read below zero",
    body: "All four radiometers sit at a negative offset before ignition. Charts here subtract the pre-ignition mean (derived).",
  },
  {
    title: "Two different O₂ values",
    body: "The experiment table gives O₂ derived from CO₂ production (Note 1); the O₂ sensor reads lower. Do not mix them.",
  },
  {
    title: "Plume thermocouples are weak evidence",
    body: "They barely respond for most samples, and a nonconformance report says their height was wrong for the SIBAL samples.",
  },
  {
    title: "Thick PMMA looks cold",
    body: "Its flame stayed anchored at the base, away from the sample thermocouples, so low peak temperature does not mean it did not burn: watch CO₂.",
  },
  {
    title: "Two flow speeds for 2-6 and 2-9",
    body: "The PSI experiment table lists 20 cm/s for every sample, but the NASA Readme (Table 1) gives 30 cm/s for samples 6 and 9. The anemometer of 2-6 averages above the others, which fits the Readme.",
  },
  {
    title: "Six thermocouple channels, two per sample",
    body: "The six ‘sample’ channels are shared by the three samples of a card row: only two respond for any burning sample. The page shows the pair of the selected sample; the pairing is our inference from the data.",
  },
  {
    title: "Very few samples",
    body: "One to four samples per material at a single condition (air, about 1 atm, about 20 cm/s). These are case descriptions, not statistics; nothing here covers lunar 30%+ O₂.",
  },
  {
    title: "Messy table cells",
    body: "Thickness ‘037 mm’ means 0.37 mm, 2-8 says ‘See Fig. 5’, 1g spread is the word ‘Acceleratory’, and camera ‘S56C2’ is a typo for S6C2. Raw values are shown next to parsed ones.",
  },
];

export const MATERIAL_GLYPH: { match: RegExp; glyph: string; label: string }[] = [
  { match: /silicone/i, glyph: "■", label: "Silicone" },
  { match: /sibal|cotton/i, glyph: "●", label: "SIBAL fabric" },
  { match: /nomex/i, glyph: "◆", label: "PMMA & Nomex" },
  { match: /pmma/i, glyph: "▲", label: "PMMA" },
];

export const glyphOf = (material: string) =>
  MATERIAL_GLYPH.find((m) => m.match.test(material)) ?? { glyph: "○", label: material };

export const SHOWCASE_SAMPLE = "2-5";

export const HOW_IT_WORKED = [
  "Nine strips of material, each the size of the Earth flammability test coupon (5 × 29 cm), sit on one card in a flow duct aboard the Cygnus cargo ship.",
  "After Cygnus left the ISS, with no crew aboard, fans drew cabin air up through the duct and each strip was lit in turn by a hot wire at its upstream end.",
  "Thermocouples on the strip, radiometers, CO₂ and O₂ sensors and two cameras recorded each burn; the data were sent to Earth before the ship burned up on re-entry.",
  "The same materials had been burned upward on Earth (1g). Comparing the two shows whether the Earth test is a safe predictor.",
];

export type Ref = { short: string; full: string; href: string };

// Sources cited on the overview. Internal links point at the Library, where the PSI files are listed.
export const REFS: Record<string, Ref> = {
  table: { short: "PSI-99 table", full: "Experiment table of SAFFIRE-II with Notes 1–4, NASA PSI (PSI-99).", href: "/studies/saffire2/library#table" },
  readme: { short: "Readme", full: "SAFFIRE-II Readme: sample layout (Fig. 1), samples (Table 1), diagnostics (Table 3). NASA, in PSI-99.", href: "/studies/saffire2/library#documents" },
  objectives: { short: "Urban et al.", full: "Schoren W., Ruff G.A., Urban D.L. The Spacecraft Fire Experiment (Saffire): Objectives, Development and Status. NASA, in PSI-99.", href: "/studies/saffire2/library#documents" },
  niehaus: { short: "Niehaus et al. 2015", full: "Niehaus J.E., Ferkul P.V., Gokoglu S.A., Ruff G.A. Buoyant Effects on the Flammability of Silicone Samples Planned for the Spacecraft Fire Experiment (Saffire). ICES-2015-293.", href: "/studies/saffire2/library#publications" },
  urban19: { short: "Urban et al. 2019", full: "Urban D.L., Ferkul P., Olson S. et al. Flame spread: Effects of microgravity and scale. Combustion and Flame (2019).", href: "https://doi.org/10.1016/j.combustflame.2018.10.012" },
  thomsen19: { short: "Thomsen et al. 2019", full: "Thomsen M., Fernandez-Pello C. et al. Buoyancy effects on concurrent flame spread over thick PMMA. Combustion and Flame (2019).", href: "https://doi.org/10.1016/j.combustflame.2018.10.016" },
  psi99: { short: "PSI-99 data", full: "NASA Physical Sciences Informatics. Spacecraft Fire Experiment-II (SAFFIRE-II, PSI-99).", href: "https://doi.org/10.60555/2chp-m469" },
};

export type Finding = {
  id: "earth" | "fabric" | "pmma" | "nomex";
  claim: string;
  evidence: "measured" | "derived";
  caveat: string;
  samples: string[];
  refs: string[];
};

// Each finding cites the samples it rests on; the numbers behind it come from the API.
export const FINDINGS: Finding[] = [
  {
    id: "earth",
    claim: "For silicone, the Earth test was the stricter one: strips that burned completely in the 1g upward test did not keep burning in microgravity at this flow.",
    evidence: "measured",
    caveat: "One flow speed and air only. Burned length here is what the table reports, not a measurement of ours.",
    samples: ["2-1", "2-4"],
    refs: ["table", "niehaus"],
  },
  {
    id: "fabric",
    claim: "SIBAL cotton-fiberglass fabric burned its full length in microgravity, as it did on Earth: for this material the 1g test is not conservative.",
    evidence: "measured",
    caveat: "Two strips, and according to the Readme 2-6 ran at 30 cm/s rather than 20.",
    samples: ["2-5", "2-6"],
    refs: ["table", "readme", "urban19"],
  },
  {
    id: "pmma",
    claim: "Thick PMMA did not spread a flame along the strip: the flame stayed at its base and consumed the plastic slowly, staying cool on the strip sensors but releasing the most CO₂.",
    evidence: "derived",
    caveat: "Peak temperature and CO₂ rise are our summaries of the flight sensors; the anchored flame is Note 4 of the table.",
    samples: ["2-8", "2-9"],
    refs: ["table", "thomsen19"],
  },
  {
    id: "nomex",
    claim: "Nomex, the flame-resistant fabric of crew clothing, did not ignite, although the thin PMMA strip below it burned away.",
    evidence: "measured",
    caveat: "A single strip; in the 1g test only the Nomex part is reported, so the two results describe different materials.",
    samples: ["2-7"],
    refs: ["table"],
  },
];

export const QUESTIONS_INTRO = "Each question opens the comparison with the right samples on shared axes.";
