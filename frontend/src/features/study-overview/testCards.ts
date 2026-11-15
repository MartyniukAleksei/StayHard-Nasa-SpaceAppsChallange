// Curated copy for the "Tests to read first" cards on the FLEX overview. Every number that appears next to a
// chart is computed from the data on the page; the text below only says what to look for and cites a source.

export type Note = { text: string; refs: string[] };

/** The d² fit window of test 107, s. Chosen by us and labelled as an estimate on the card. */
export const FIT_WINDOW_107: [number, number] = [0.5, 14];

/** Frames further apart than this are shown as a gap, never joined by a line, s. */
export const GAP_MIN_S = 0.5;

export const CARD_107: { test: number; phenomenon: string; title: string; notes: Note[] } = {
  test: 107,
  phenomenon: "d² law",
  title: "A droplet that follows the d² law, then breaks",
  notes: [
    {
      text: "In quasi-steady burning the squared diameter falls linearly, d² = d₀² − K·t. K is the burning-rate constant; the NASA value is in the tests table, the fit on the chart is our estimate.",
      refs: ["godsave", "spalding", "dietrich"],
    },
    {
      text: "The flame standoff ratio FSR = D_flame / d (from the colour camera) shows when the flame becomes quasi-steady: it first rises while the flame grows, then levels off. Fit K only after it has levelled off.",
      refs: ["dietrich"],
    },
    {
      text: "The last points leave the straight line. This test ends in Disruption, which means self-extinction was not observed. It does not mean the flame would have burned on. Do not fit K through those points.",
      refs: ["psi69"],
    },
  ],
};

export const CARD_13: { test: number; phenomenon: string; title: string; notes: Note[] } = {
  test: 13,
  phenomenon: "Measurement gaps",
  title: "A record with a hole in it",
  notes: [
    {
      text: "The droplet series has a stretch with no frames. The shaded band is computed from the timestamps. A line drawn across it invents measurements, so the chart leaves it open.",
      refs: ["psi69"],
    },
    {
      text: "Fit K only on a window of continuous, quasi-steady points, and check the residual. A fit that spans a gap or the ignition transient shifts K.",
      refs: ["godsave", "dietrich"],
    },
    {
      text: "Diameters are measured on backlit images by an edge tracer. The files carry no per-frame uncertainty, so a sooty frame looks as reliable as a clean one. The precision depends on soot and image quality.",
      refs: ["rasul"],
    },
  ],
};

export const CARD_117: { id: string; phenomenon: string; title: string; notes: Note[] } = {
  id: "PSI-117",
  phenomenon: "Cool flame · simulation",
  title: "A flame you cannot see",
  notes: [
    {
      text: "In this simulation of a burning droplet the peak gas temperature rises to a hot-flame peak, then settles on a low-temperature branch. That branch is a cool flame: reactions continue after the visible flame is gone.",
      refs: ["farouk", "ahmed"],
    },
    {
      text: "The two cases differ in how the cool flame behaves: one holds steady, the other oscillates. The droplet is consumed in both.",
      refs: ["ahmed"],
    },
    {
      text: "In FLEX, heptane droplets showed this after visible extinction, so “the flame went out” is not the same as “burning stopped”. See test #35 and the cool-flame papers.",
      refs: ["nayagam12", "nayagam14"],
    },
  ],
};
