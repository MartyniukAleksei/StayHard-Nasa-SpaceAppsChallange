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

export type Trap = { title: string; body: string; cite?: { test: number; quote: string } };

export const TRAPS: Trap[] = [
  {
    title: "Disruption ≠ “would burn forever”",
    body: "A disrupted test was stopped before the flame could go out on its own. It tells you self-extinction was not observed, nothing more.",
  },
  {
    title: "Extinguished ≠ safe",
    body: "After the visible flame dies, heptane can keep reacting as a cool flame, invisible to the eye.",
    cite: { test: 35, quote: "This behavior is indicative of cool flame burning and extinction." },
  },
];

export type Finding = { text: string; test: number; doi: string };

/** Three findings, each with a test to look at and the publication behind it (team-approved 2026-11-15). */
export const FINDINGS: Finding[] = [
  {
    text: "After the visible flame goes out, a heptane droplet can keep burning as an invisible, low-temperature cool flame: a second burning stage.",
    test: 35,
    doi: "10.1016/j.combustflame.2012.07.012",
  },
  {
    text: "A support fiber changes the burning rate and the shape of the flame, so droplets held on a fiber and free-floating droplets are not compared directly.",
    test: 49,
    doi: "10.1080/13647830.2010.547601",
  },
  {
    text: "A methanol flame in ISS air can go out by itself long before the droplet has burned away.",
    test: 34,
    doi: "10.1016/j.combustflame.2013.05.011",
  },
];
