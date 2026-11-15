// Curated text for the BASS-II pages. No statistics here: counts come from the API.
// Every claim points to a page of NASA/TM-20210011385 (BASS-II Summary Report, 2021).

export const HERO_QUESTION = "Can a material that passes Earth's fire test still burn in space?";

export const HERO_LEDE =
  "On Earth, hot gas rises and feeds a flame. On the ISS there is no buoyancy: only the ventilation " +
  "moves air, a few centimetres per second. BASS-II burned spacecraft materials in a small wind " +
  "tunnel aboard the station and turned the fan down and up until the flame went out.";

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

export const HOW_IT_WORKED = [
  "A small wind tunnel inside the Microgravity Science Glovebox: a fan, a honeycomb to straighten the flow, the sample in the test section, and a copper plate and brass screen at the exit (p. 4–5).",
  "Before a burn the crew could lower the oxygen in the glovebox by bleeding in nitrogen; O₂, CO₂ and CO were read before and after each burn (p. 6).",
  "The astronaut ignited the sample with a hot wire on a lever, then a scientist on the ground talked the crew through each fan step by voice, looking for the flow at which the flame dies (p. 3, 68).",
  "A video camera recorded the burn through a mirror with the readings burned into the picture; a Nikon took a still every second from above; a radiometer tracked the flame's glow (p. 5).",
];

export type FindingCopy = {
  id: "earth_vs_space" | "co_per_co2" | "stoichiometry";
  claim: string;
  evidence: "measured" | "derived";
  caveat: string;
  refs: string[];
};

export const FINDINGS: FindingCopy[] = [
  {
    id: "earth_vs_space",
    claim: "PMMA rods burned in microgravity at less oxygen than the Earth upward-burning limit.",
    evidence: "derived",
    caveat: "Each mark is the oxygen at ignition; the outcome is our reading of the researchers' log. The lowest boundary point comes from the final oxygen of a test, which is lower than its starting value.",
    refs: ["olson17", "report"],
  },
  {
    id: "co_per_co2",
    claim: "How much carbon monoxide a fire makes depends on its shape: rods burning with the flow made more CO per unit of CO₂ than slabs burning against it.",
    evidence: "derived",
    caveat: "Gases were read only before and after each burn, in the closed glovebox. Tests with CO over the sensor range are left out.",
    refs: ["report"],
  },
  {
    id: "stoichiometry",
    claim: "Oxygen was used up in the ratio PMMA's chemistry predicts: six O₂ for every five CO₂.",
    evidence: "derived",
    caveat: "The O₂ sensor reads in 0.1 % steps, so small burns scatter widely. Impossible final O₂ values in the source table are left out.",
    refs: ["report"],
  },
];

/** Questions that open the explorer with matching filters. */
export const PRESETS: { question: string; params: string }[] = [
  { question: "Which tests went out by themselves at low flow?", params: "outcome=quench" },
  { question: "Which were blown out by strong flow?", params: "outcome=blowoff" },
  { question: "What did not ignite at all?", params: "outcome=no_ignition" },
  { question: "Rods: the U-shaped boundary tests", params: "pi=Olson" },
  { question: "Fabric in concurrent flow", params: "material=fabric" },
  { question: "Tests with a video stored on the site", params: "media=video" },
];
