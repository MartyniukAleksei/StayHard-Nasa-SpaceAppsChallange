// Curated text for the BASS-II pages. No statistics here: counts come from the API.
// Every claim points to a page of NASA/TM-20210011385 (BASS-II Summary Report, 2021).

export const HERO_QUESTION = "Can a material that passes Earth's fire test still burn in space?";

export const HERO_LEDE =
  "On Earth, hot gas rises and feeds a flame. On the ISS there is no buoyancy: only the ventilation " +
  "moves air, a few centimetres per second. BASS-II burned spacecraft materials in a small wind " +
  "tunnel aboard the station and turned the fan down and up until the flame went out.";

export const WHY_TITLE = "Why the Earth test may not be conservative";

export const WHY_TEXT =
  "NASA screens materials with an upward-burning test (NASA-STD-6001, Test 1): on Earth, a flame " +
  "spreading upward is the worst case because buoyancy drives fresh air into it. In microgravity " +
  "the flow can be weak but just right, and some materials keep burning at less oxygen than the " +
  "Earth test would suggest.";

export const U_MAP_TITLE = "The flame lives inside a U";

export const U_MAP_TEXT = [
  "Plot flow speed against oxygen and the flame survives only inside a U-shaped bowl (p. 64, 75).",
  "Right branch, blowoff: too much flow. Gas leaves before it can react. Blowoff starts as a hole at the stagnation point and the flame does not come back when the flow is turned down (p. 73).",
  "Left branch, quenching: almost no flow. Oxygen arrives only by diffusion and the surface loses heat by radiation. The flame shrinks to a small blue hemisphere and oscillates before it goes out (p. 72).",
  "The bottom of the bowl, the lowest oxygen at which the material burns at all, sits at a weak but non-zero flow. On Earth buoyancy alone makes a flow much faster than that, so the bottom cannot be reached in a ground test (p. 48, 76).",
];

export type Team = {
  letter: string;
  pi: string; // must match TestRow.pi / Facts.by_pi keys
  affiliation: string;
  sample: string;
  geometry: string;
  takeaway: string;
  page: number;
};

export const TEAMS: Team[] = [
  {
    letter: "O",
    pi: "Olson",
    affiliation: "NASA Glenn",
    sample: "PMMA rods (mostly clear), three diameters",
    geometry: "Ignited at the upstream tip: stagnation and concurrent flow",
    takeaway:
      "Mapped the full U-shaped flammability boundary for rods and fitted it with an empirical equation. Ignition needs more oxygen than keeping a flame alive.",
    page: 64,
  },
  {
    letter: "P",
    pi: "Fernandez-Pello",
    affiliation: "UC Berkeley",
    sample: "PMMA rods (mostly black), three diameters",
    geometry: "Ignited at the downstream end: flame spreads against the flow",
    takeaway:
      "Flame spread in microgravity at lower oxygen than on Earth. Burning rods keep bursting vapour bubbles, so suppression must continue until the material cools.",
    page: 47,
  },
  {
    letter: "B",
    pi: "Bhattacharjee",
    affiliation: "San Diego State University",
    sample: "Thin PMMA films, 0.1–0.4 mm",
    geometry: "Flame spreads against the flow",
    takeaway:
      "The flow below which a flame dies by radiation does not depend on film thickness, and a simple formula predicts it.",
    page: 13,
  },
  {
    letter: "M",
    pi: "Miller",
    affiliation: "San Diego State University, with Wichman (Michigan State)",
    sample: "Thick PMMA slabs, 1–5 mm, burning on one or two sides",
    geometry: "Flame spreads against the flow",
    takeaway:
      "Benchmark for a ground apparatus that suppresses buoyancy in a narrow channel. Below a certain oxygen level two-sided slabs stop spreading and burn back from the trailing edge.",
    page: 55,
  },
  {
    letter: "T",
    pi: "T'ien",
    affiliation: "Case Western Reserve University",
    sample: "SIBAL cotton–fiberglass fabric; one PMMA hemisphere",
    geometry: "Concurrent flow: flame spreads with the flow",
    takeaway:
      "First clean measurement of the low-speed quenching boundary for concurrent spread. The flame shrinks in length and width and goes out in three dimensions.",
    page: 93,
  },
  {
    letter: "F",
    pi: "Ferkul",
    affiliation: "Project scientist, NASA Glenn / USRA",
    sample: "Nomex III fire-barrier fabric; a Japan-wax candle left over from BASS-I",
    geometry: "Concurrent and opposed flow",
    takeaway:
      "Nomex, used aboard the ISS as a fire barrier, did not ignite. The candle shed a molten wax droplet upstream, showing how melting plastics can spread fire.",
    page: 46,
  },
];

export const CREW_TITLE = "What it means for the crew";

export const TRAPS: { title: string; text: string }[] = [
  {
    title: "Outcome and flow type come from the report, not the PSI table",
    text: "The PSI test table has conditions only. How each test ended and which way the flow ran come from Appendix A of the NASA report (p. 103–113); the outcome is our reading of the researchers' notes and is labelled derived.",
  },
  {
    title: "Oxygen is known only at the start and the end",
    text: "O₂ was read before and after each burn and corrected with the station mass spectrometer. A few final readings in the source are impossible values; we flag them instead of hiding them.",
  },
  {
    title: "Fan and air readings are free text",
    text: "The fan column lists every step during a test (fan display ×10 V or potentiometer setting). The air-speed sensor responds in about a minute, so its value is reliable only on long steady steps. Each day had its own fan calibration.",
  },
  {
    title: "Video dates are one day ahead",
    text: "The on-board computer missed the leap year, so the date burned into the video is one day later than the real test date (ReadMe).",
  },
  {
    title: "The radiometer is uncalibrated",
    text: "It shows relative brightness and flame dynamics (for example oscillations before quenching), not absolute heat flux.",
  },
];

export const REPORT_CITATION =
  "Olson S.L., Ferkul P.V., Bhattacharjee S., Miller F.J., Fernandez-Pello C., Link S., T'ien J.S., Wichman I. Burning and Suppression of Solids–II (BASS–II) Summary Report. NASA/TM-20210011385, October 2021.";
