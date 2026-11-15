// Report-derived constants for the BASS-II apparatus scene. Nothing here is fetched: every number
// is quoted from NASA/TM-20210011385 (BASS-II Summary Report, 2021) with its printed page
// (PDF page = printed page + 8). Sizes marked "schematic" have no source and are labelled so in the UI.

export const REPORT = {
  title: "NASA/TM-20210011385, BASS-II Summary Report (2021)",
  accession: "PSI-25",
  doi: "10.60555/4qc4-de67",
  doiUrl: "https://doi.org/10.60555/4qc4-de67",
} as const;

/** Flow duct test section, mm (p.4: "7.6- by 7.6- by 17-cm rectangular flow duct with rounded corners"). */
export const DUCT = {
  width: 76,
  height: 76,
  length: 170,
  cornerRadius: 9, // schematic: the report only says "rounded corners"
  fanSectionLength: 62, // schematic
} as const;

/** Flow range of the fan (p.4): ~55 cm/s with no restrictors, ~35 cm/s with two. */
export const FLOW = {
  maxCmS: 55,
  maxTwoRestrictorsCmS: 35,
  /** Lower end of the slider; schematic (flames survived "at airflow less than 1 cm/s", p.66). */
  minCmS: 0.1,
  /**
   * Below this we show no number. The daily fan calibrations (Fan calibration data.xlsx) stop at pot 0.5,
   * which reads 0 to 3.75 cm/s depending on the day; the air-speed display resolves ±0.5 cm/s (p.66).
   */
  calibratedMinCmS: 2,
  /** Typical ignition flow for the rods (p.67). */
  ignitionCmS: 5,
} as const;

/** O2 range of the control, % by volume. Tests ran from 13.6 to 22.2 % (p.64). */
export const O2 = {
  min: 13,
  max: 21,
  start: 15.5, // inside the 13.6 to 16 % range where the rod limits were mapped (p.68, Fig. 6.9)
  /** Below this a sustained ignition could not be achieved (p.68). */
  ignitionLimit: 14.5,
  /** Lowest final O2 a burning flame survived to (p.68). */
  lowestSurvived: 13.6,
  /** 1g upward flame spread limit with an additional 4 cm/s forced flow (p.76, Ref. 23 of the report). */
  earthUpwardLimit: 15.4,
} as const;

/** Clear cast PMMA rod radii, cm (p.67). The first is the base size r0 of Eq. 6.1. */
export const ROD_RADII_CM = [0.318, 0.476, 0.635] as const;

/** Radiometer oscillation before quenching extinction, Hz (p.72, Fig. 6.6; measured in one test). */
export const PRE_QUENCH_HZ = 1.1;

export type ConfigId = "flat" | "rod-concurrent" | "rod-opposed" | "fabric";
export type ModeId = "flat" | "rod" | "fabric";
export type Regime = "burning" | "quench" | "blowoff";

export interface Fact {
  text: string;
  page: number;
}

/** One qualitative flow setting for the configurations that have no boundary equation. */
export interface Level {
  id: string;
  label: string;
  regime: Regime;
  /** What the report says happens here. */
  caption: string;
  page: number;
  /** Tracer speed, cm/s: a representative value inside the range the caption quotes. */
  tracerCmS: number;
  /** Schematic flame look for a burning level. */
  flame?: { length: number; height: number; width: number; closed: boolean; opacity: number };
}

export interface Config {
  id: ConfigId;
  mode: ModeId;
  title: string;
  investigators: string;
  sample: string;
  samplePage: number;
  flow: "opposed" | "concurrent";
  ignition: string;
  facts: Fact[];
  levels: Level[];
  startLevel: number;
}

export const CONFIGS: Record<ConfigId, Config> = {
  flat: {
    id: "flat",
    mode: "flat",
    title: "Flat PMMA sample, opposed flow",
    investigators: "Bhattacharjee (thin films), Miller & Wichman (thick slabs)",
    sample: "PMMA film 20 mm wide, about 95 mm long, 100–400 µm thick; slabs up to 5 mm",
    samplePage: 21,
    flow: "opposed",
    ignition: "Ignited at the downstream end; the flame travels upstream, against the flow.",
    facts: [
      { text: "Extinction velocity ≈ 1 cm/s for 100–300 µm films and ≈ 1.5 cm/s for 400 µm at 21 % O₂.", page: 13 },
      { text: "At about 16 % O₂ extinction came at ≈ 2.6 cm/s (100 µm) and ≈ 4 cm/s (200 µm).", page: 15 },
      { text: "Highest spread rate in microgravity: 2.2 mm/s, with flow varied from about 40 to about 1 cm/s.", page: 41 },
    ],
    levels: [
      {
        id: "low",
        label: "about 1 cm/s",
        regime: "quench",
        caption:
          "Radiative extinction: the flame shrinks, loses its orange colour, turns completely blue and goes out.",
        page: 13,
        tracerCmS: 1,
      },
      {
        id: "mid",
        label: "a few cm/s",
        regime: "burning",
        caption: "Steady opposed-flow spread along the sample.",
        page: 13,
        tracerCmS: 5,
        flame: { length: 17, height: 10, width: 25, closed: false, opacity: 1 },
      },
      {
        id: "high",
        label: "very high flow",
        regime: "blowoff",
        caption: "Kinetically driven blowoff extinction was observed at very high flow velocity.",
        page: 41,
        tracerCmS: 40,
      },
    ],
    startLevel: 1,
  },
  "rod-concurrent": {
    id: "rod-concurrent",
    mode: "rod",
    title: "PMMA rod, concurrent (stagnation) flow",
    investigators: "Olson & Ferkul",
    sample: "Clear cast PMMA rod, radius 0.318, 0.476 or 0.635 cm, hemispherical tip",
    samplePage: 67,
    flow: "concurrent",
    ignition: "Ignited at the hemispherical tip that faces the flow; the flame wraps the tip.",
    facts: [
      { text: "The boundary has its minimum near 13.5 % O₂ at a stretch rate of 8 to 12 s⁻¹.", page: 75 },
      { text: "Below about 14.5 % O₂ a sustained ignition could not be achieved, yet burning flames survived down to 13.6 %.", page: 68 },
      { text: "Before quenching the flame shrinks to a hemisphere and oscillates at about 1.1 Hz.", page: 72 },
      { text: "Blowoff starts as a hole in the flame at the stagnation tip.", page: 73 },
    ],
    levels: [],
    startLevel: 0,
  },
  "rod-opposed": {
    id: "rod-opposed",
    mode: "rod",
    title: "PMMA rod, opposed flow",
    investigators: "Fernandez-Pello",
    sample: "Black cast PMMA rod, diameter 6.35, 9.525 or 12.7 mm",
    samplePage: 48,
    flow: "opposed",
    ignition: "Ignited at the downstream end; the flame travels upstream along the rod.",
    facts: [
      { text: "Flame spread was observed down to 17.5 % O₂ in microgravity; in normal gravity not below 19 %.", page: 50 },
      { text: "Tested flow velocities ran from 0.41 to 7.5 cm/s; buoyant flow on Earth is about 50 cm/s.", page: 48 },
      { text: "Suppression should be maintained until the material has cooled and stopped emitting vapors.", page: 52 },
    ],
    levels: [
      {
        id: "low",
        label: "below ~4 mm/s",
        regime: "quench",
        caption: "Sustained flame spread was not observed below approximately 4 mm/s (6.35 and 9.525 mm rods).",
        page: 48,
        tracerCmS: 0.3,
      },
      {
        id: "mid",
        label: "very low flow",
        regime: "burning",
        caption: "Flames are very small, blue, faint and open at their downstream ends.",
        page: 48,
        tracerCmS: 1,
        flame: { length: 6, height: 15, width: 15, closed: false, opacity: 0.6 },
      },
      {
        id: "high",
        label: "~20 mm/s and above",
        regime: "burning",
        caption: "Flames become much more luminous, with a closed downstream tip.",
        page: 48,
        tracerCmS: 4,
        flame: { length: 20, height: 19, width: 19, closed: true, opacity: 1 },
      },
    ],
    startLevel: 2,
  },
  fabric: {
    id: "fabric",
    mode: "fabric",
    title: "Cotton-fiberglass fabric (SIBAL), concurrent flow",
    investigators: "T'ien",
    sample: "Fabric 1.2 or 2.2 cm wide, 10 cm exposed length, about 0.32 mm thick, in a stainless steel holder",
    samplePage: 94,
    flow: "concurrent",
    ignition: "Ignited at the leading edge; the flame grows and travels downstream, with the flow.",
    facts: [
      { text: "Quenching speeds were between 1 and 5 cm/s, higher in a lower-O₂ atmosphere.", page: 93 },
      { text: "O₂ was varied from 21 % down to 16 % and flow speed from 40 cm/s down to 1 cm/s.", page: 93 },
      { text: "At 10 cm/s and 21 % O₂ one 2.2 cm sample burned out in about 40 s.", page: 95 },
    ],
    levels: [
      {
        id: "low",
        label: "below the quenching limit",
        regime: "quench",
        caption: "Low-speed quenching: the limit lay between 1 and 5 cm/s depending on O₂.",
        page: 93,
        tracerCmS: 1,
      },
      {
        id: "mid",
        label: "low flow",
        regime: "burning",
        caption: "At low flow speed and O₂ the flame became very dim blue and small.",
        page: 94,
        tracerCmS: 5,
        flame: { length: 13, height: 9, width: 21, closed: false, opacity: 0.6 },
      },
      {
        id: "high",
        label: "higher flow",
        regime: "burning",
        caption: "A long flame grows downstream of its base and can reach a limiting length (10 cm/s, 21 % O₂).",
        page: 95,
        tracerCmS: 10,
        flame: { length: 44, height: 13, width: 26, closed: false, opacity: 1 },
      },
    ],
    startLevel: 2,
  },
};

export const MODES: { id: ModeId; label: string; configs: ConfigId[] }[] = [
  { id: "flat", label: "flat sample", configs: ["flat"] },
  { id: "rod", label: "rod", configs: ["rod-concurrent", "rod-opposed"] },
  { id: "fabric", label: "fabric", configs: ["fabric"] },
];

/**
 * Sample placement inside the duct, mm along the flow axis (x = 0 is the middle of the test section,
 * +x is downstream). Lengths come from the report where stated; positions are schematic.
 */
export const LAYOUT = {
  rodConcurrent: { tipX: -26, endX: 40 }, // rod length: schematic
  rodOpposed: { startX: -42, endX: 26, radiusMm: 3.175 }, // 6.35 mm rod (p.48); length schematic
  flat: { halfLength: 47.5, width: 20, thickness: 1.2 }, // 95 x 20 mm (p.21); thickness thickened to be visible
  fabric: { halfLength: 50, width: 22, thickness: 0.8 }, // 100 x 22 mm (p.94); thickness thickened
  /** Flame standoff from the rod surface: schematic. */
  standoff: 2.2,
} as const;
