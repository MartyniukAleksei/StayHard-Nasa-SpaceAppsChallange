// No runtime imports: node:test loads this file directly (constants live in content.ts and are passed in).
import type { Regime } from "../content";

/** Base rod radius r0 of Eq. 6.1, cm (report p.75, symbols p.65). */
export const R0_CM = 0.318;

/**
 * Forced stretch rate, 1/s (report p.75): a = (3/2)(U/r)(r/r0)^1/2.
 * U is the free-stream velocity in cm/s, r the rod radius in cm.
 */
export function stretchRate(uCmS: number, rCm: number): number {
  return 1.5 * (uCmS / rCm) * Math.sqrt(rCm / R0_CM);
}

/** Inverse of stretchRate for a given rod radius. */
export function flowForStretch(a: number, rCm: number): number {
  return (a * rCm) / (1.5 * Math.sqrt(rCm / R0_CM));
}

/**
 * Flammability boundary of PMMA rods in concurrent flow, % O2 by volume (Eq. 6.1, report p.75):
 * X_O2 = 6 exp(-0.5 a) + 0.0167 a + 13.4. The exponential term is the quenching branch,
 * the linear term the blowoff branch. An empirical fit by the report's authors.
 */
export function boundaryO2(a: number): number {
  return 6 * Math.exp(-0.5 * a) + 0.0167 * a + 13.4;
}

/** Stretch rate at the minimum of Eq. 6.1 (dX/da = 0): about 10.4 1/s, inside the report's "8 to 12". */
export const A_AT_MINIMUM = 2 * Math.log(3 / 0.0167);

/**
 * Which side of Eq. 6.1 a setting falls on. Below the curve the branch is chosen by the side of the
 * minimum: left is quenching, right is blowoff. An estimate: the authors' curve applied to chosen values.
 */
export function rodRegime(uCmS: number, rCm: number, o2Pct: number): Regime {
  const a = stretchRate(uCmS, rCm);
  if (o2Pct >= boundaryO2(a)) return "burning";
  return a < A_AT_MINIMUM ? "quench" : "blowoff";
}

/** A sustained ignition was not achieved below the ignition limit (about 14.5 % O2, report p.68). */
export function canIgnite(o2Pct: number, ignitionLimitPct: number): boolean {
  return o2Pct >= ignitionLimitPct;
}

/** Flow speed as shown on screen: no number below the fan's calibrated range. */
export function flowLabel(uCmS: number, calibratedMinCmS: number): string {
  if (uCmS < calibratedMinCmS) return `< ~${calibratedMinCmS} cm/s (below calibrated range)`;
  return `${uCmS < 10 ? uCmS.toFixed(1) : uCmS.toFixed(0)} cm/s`;
}

/** Slider position 0..1 to flow speed on a log scale between min and max, cm/s. */
export function sliderToFlow(x: number, minCmS: number, maxCmS: number): number {
  const c = Math.min(1, Math.max(0, x));
  return minCmS * Math.pow(maxCmS / minCmS, c);
}

export function flowToSlider(uCmS: number, minCmS: number, maxCmS: number): number {
  const u = Math.min(maxCmS, Math.max(minCmS, uCmS));
  return Math.log(u / minCmS) / Math.log(maxCmS / minCmS);
}
