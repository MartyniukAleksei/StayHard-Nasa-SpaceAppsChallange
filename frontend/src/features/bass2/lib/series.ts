// Pure helpers for the BASS-II overview charts. Self-contained (types only from "../types").
import type { TestRow, VideoSeries } from "../types";

export type Pt = [number, number];

/** One column of a video series as [t, value] points, skipping missing values. */
export function seriesColumn(s: VideoSeries | null | undefined, name: string, f: (v: number) => number = (v) => v): Pt[] {
  if (!s) return [];
  const i = s.columns.indexOf(name);
  if (i < 0) return [];
  return s.points.filter((p) => p[i] != null && p[0] != null).map((p) => [p[0] as number, f(p[i] as number)]);
}

/** First time the air reading drops to ≤ `eps` cm/s and stays there for `hold` seconds. */
export function zeroFlowAt(air: Pt[], eps = 0.5, hold = 30): number | null {
  for (let i = 0; i < air.length; i++) {
    const [t] = air[i];
    const rest = air.filter(([x]) => x >= t && x < t + hold);
    if (rest.length && rest.every(([, v]) => v <= eps) && air[air.length - 1][0] - t >= hold) return t;
  }
  return null;
}

/**
 * Estimate of when the flame stops being visible in the video: the last time the bright-pixel count is
 * at or above `level`, followed by at least `minQuiet` s (up to `quiet` s, or the end of the record) below it.
 */
export function flameOutAt(scene: Pt[], level = 100, quiet = 60, minQuiet = 20): number | null {
  for (let i = 0; i < scene.length; i++) {
    const [t, v] = scene[i];
    if (v < level) continue;
    const after = scene.filter(([x]) => x > t && x <= t + quiet);
    const span = after.length ? after[after.length - 1][0] - t : 0;
    if (span >= minQuiet && after.every(([, x]) => x < level)) return t;
  }
  return null;
}

/** Least-squares slope of y = k·x through the origin. */
export function slopeThroughOrigin(pts: Pt[]): number | null {
  const sxx = pts.reduce((s, [x]) => s + x * x, 0);
  if (!pts.length || sxx === 0) return null;
  return pts.reduce((s, [x, y]) => s + x * y, 0) / sxx;
}

/** CO produced (ppm) against CO₂ produced (% vol) in one test, from the start/end gas readings. */
export function coVsCo2(t: TestRow): Pt | null {
  const { co_initial_ppm: a, co_final_ppm: b, co2_initial_pct: c, co2_final_pct: d } = t;
  if (a == null || b == null || c == null || d == null || t.co_over_range) return null;
  const dco2 = d - c;
  const dco = b - a;
  return dco2 > 0 ? [dco2, dco] : null;
}

/** O₂ consumed against CO₂ produced (both % vol) in one test; impossible O₂ readings are skipped. */
export function o2VsCo2(t: TestRow): Pt | null {
  const { o2_initial_pct: a, o2_final_pct: b, co2_initial_pct: c, co2_final_pct: d } = t;
  if (a == null || b == null || c == null || d == null || t.o2_final_suspect) return null;
  const dco2 = d - c;
  const do2 = a - b;
  return dco2 > 0 && do2 >= 0 ? [dco2, do2] : null;
}

/** All numbers in a report value string, e.g. "~550 ppm … ~370 …" → [550, 370]. */
export const numbers = (s: string | null | undefined): number[] =>
  (s ?? "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
