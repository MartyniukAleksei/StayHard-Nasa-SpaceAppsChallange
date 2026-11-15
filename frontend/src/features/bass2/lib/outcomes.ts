// Outcome of a BASS-II test, derived from the Appendix A observations (NASA/TM-20210011385).
// Colour never stands alone: every outcome has its own glyph (DS rule, colour-blind safe).
// Self-contained (no "@/" runtime imports) so node:test can run it.

export type OutcomeKey =
  | "quench"
  | "blowoff"
  | "no_ignition"
  | "flow_off"
  | "burnout"
  | "sustained"
  | "unknown";

export type Tone = "ext" | "com" | "dis" | "ash" | "ink";

export type OutcomeStyle = {
  label: string;
  short: string;
  glyph: string;
  shape: "dot" | "diamond" | "cross" | "square" | "ring" | "ringdot" | "dash";
  tone: Tone;
  /** Did the material keep burning? Used to group outcomes for the safety reading. */
  burned: boolean;
};

export const OUTCOMES: Record<OutcomeKey, OutcomeStyle> = {
  quench: { label: "Went out by itself at low flow", short: "Quenched", glyph: "●", shape: "dot", tone: "ext", burned: false },
  blowoff: { label: "Blown off by strong flow", short: "Blown off", glyph: "◇", shape: "diamond", tone: "dis", burned: false },
  no_ignition: { label: "Did not ignite", short: "No ignition", glyph: "×", shape: "cross", tone: "ash", burned: false },
  flow_off: { label: "Put out by stopping the fan", short: "Fan off", glyph: "■", shape: "square", tone: "ash", burned: true },
  burnout: { label: "Burned the whole sample", short: "Burned out", glyph: "○", shape: "ring", tone: "com", burned: true },
  sustained: { label: "Still burning when the test ended", short: "Kept burning", glyph: "◎", shape: "ringdot", tone: "com", burned: true },
  unknown: { label: "Not stated in the log", short: "Not stated", glyph: "–", shape: "dash", tone: "ash", burned: false },
};

export const OUTCOME_ORDER: OutcomeKey[] = [
  "quench",
  "blowoff",
  "no_ignition",
  "flow_off",
  "burnout",
  "sustained",
  "unknown",
];

export const outcomeStyle = (o: string | null | undefined): OutcomeStyle =>
  OUTCOMES[(o ?? "unknown") as OutcomeKey] ?? OUTCOMES.unknown;

/** First number in a report value such as "13.5% O₂" or "~14.5% O₂ to ignite". */
export const firstNumber = (s: string | null | undefined): number | null => {
  const m = s?.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/**
 * Vertical offsets for a strip plot: points with the same x (within `bin`) in one lane are
 * spread symmetrically (0, +1, −1, +2, …) so no glyph hides another.
 */
export function jitter(xs: (number | null)[], bin: number): number[] {
  const seen = new Map<number, number>();
  return xs.map((x) => {
    if (x == null) return 0;
    const k = Math.round(x / bin);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return n === 0 ? 0 : n % 2 ? (n + 1) / 2 : -n / 2;
  });
}
