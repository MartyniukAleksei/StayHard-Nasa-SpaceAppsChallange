// Curated copy for the FLEX overview (blocks A, B, D, Q). No numbers here: every number on
// the page comes from the API. Test numbers below are citations, not statistics.

export const HERO_QUESTION =
  "When does a flame in space go out by itself — and what does it take to put it out?";

export const HERO_VARIED = "O₂, pressure, CO₂, He";

export const HOW_IT_WORKED = [
  "A single fuel droplet is deployed inside the combustion chamber and ignited.",
  "With no gravity there is no buoyancy, so the flame forms an almost perfect sphere around the droplet.",
  "As it burns, the droplet shrinks; its diameter follows d² = d₀² − K·t, where K is the burning-rate constant.",
];

export const END_DEFINITIONS = {
  Extinction: "the flame went out by itself while fuel was still left",
  Completion: "the droplet burned away completely",
  Disruption: "the test ended early; self-extinction was not observed",
} as const;

/** The test shown as the 3D example on the overview (methanol in ISS air, goes out by itself). */
export const SHOWCASE_TEST = 33;

export type Finding = {
  /** The claim, as approved by the team 2026-11-15. */
  claim: string;
  test: number;
  /** Where the evidence comes from: a measurement, or something we derive from measurements. */
  evidence: "measured" | "derived";
  /** What to keep in mind when reading the chart. */
  caveat: string;
  refs: string[];
};

export const FINDINGS: Finding[] = [
  {
    claim:
      "After the visible flame goes out, a heptane droplet can keep burning as an invisible, low-temperature cool flame: a second burning stage.",
    test: 35,
    evidence: "measured",
    caveat: "The series shows the droplet still vaporising after the flame is gone. That it is a cool flame is the researchers’ reading, in the comment and the papers.",
    refs: ["nayagam12", "nayagam14", "farouk"],
  },
  {
    claim:
      "A support fiber changes the burning rate and the shape of the flame, so droplets held on a fiber and free-floating droplets are not compared directly.",
    test: 49,
    evidence: "derived",
    caveat: "One pair of tests is an illustration, not proof: the initial diameters differ and #49 also has a data gap. The effect itself is shown and modelled in the paper.",
    refs: ["farouk11"],
  },
  {
    claim: "A methanol flame in ISS air can go out by itself long before the droplet has burned away.",
    test: 34,
    evidence: "measured",
    caveat: "In this test the droplet left the camera’s field of view near extinction and no extinction diameter is listed. The test has no flame series, so the time the flame went out is not in the data.",
    refs: ["nayagam13", "dietrich"],
  },
];
