// Our own estimate of the burning-rate constant K from the measured droplet series:
// least squares on d²(t) = d₀² − K·t over the quasi-steady part of the burn. Everything here is
// an *estimate* and is labelled "derived" in the UI next to NASA's reported K.

export type Pt = [t: number, v: number];

export type D2Fit = {
  /** burning-rate constant, mm²/s (= −slope of d² vs t) */
  k: number;
  /** d² at t = 0 from the fitted line, mm² */
  intercept: number;
  r2: number;
  n: number;
  /** fitted window, s */
  t0: number;
  t1: number;
};

/** Points needed for a meaningful fit. */
const MIN_POINTS = 5;
/** The heat-up peak is looked for in this first share of the window. */
const HEATUP_SHARE = 0.4;

/** Ordinary least squares y = a + b·x. */
export function linearFit(pts: Pt[]): { a: number; b: number; r2: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) {
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const den = n * sxx - sx * sx;
  if (den === 0) return null;
  const b = (n * sxy - sx * sy) / den;
  const a = (sy - b * sx) / n;
  const mean = sy / n;
  let ssTot = 0, ssRes = 0;
  for (const [x, y] of pts) {
    ssTot += (y - mean) ** 2;
    ssRes += (y - (a + b * x)) ** 2;
  }
  return { a, b, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

/**
 * Fit d² vs t. `d2` = [t_s, d² mm²], t ≥ 0. The window starts at the largest d² within the first
 * part of the burn (the droplet first heats up and even swells, so the earliest points lie off
 * the line) and ends at flame-out (`tEnd`, NASA's burn time) or the last point.
 */
export function fitD2(d2: Pt[], tEnd: number | null): D2Fit | null {
  const pts = d2.filter(([t, v]) => t >= 0 && Number.isFinite(v) && (tEnd == null || t <= tEnd));
  if (pts.length < MIN_POINTS) return null;
  const tLast = pts[pts.length - 1][0];
  const horizon = pts[0][0] + (tLast - pts[0][0]) * HEATUP_SHARE;
  let peak = 0;
  for (let i = 1; i < pts.length && pts[i][0] <= horizon; i++) if (pts[i][1] > pts[peak][1]) peak = i;
  const win = pts.slice(peak);
  const fit = win.length >= MIN_POINTS ? linearFit(win) : null;
  if (!fit || fit.b >= 0) return null;
  return { k: -fit.b, intercept: fit.a, r2: fit.r2, n: win.length, t0: win[0][0], t1: win[win.length - 1][0] };
}

/** Straight fit line across its window, for drawing (dashed). */
export function fitLine(fit: D2Fit): Pt[] {
  return [fit.t0, fit.t1].map((t) => [t, fit.intercept - fit.k * t] as Pt);
}

/**
 * Time ranges with no measurements: a step much longer than the usual sampling step
 * (> `factor` × median and > `minS` seconds).
 */
export function findGaps(times: number[], factor = 10, minS = 0.3): [number, number][] {
  if (times.length < 3) return [];
  const steps = times.slice(1).map((t, i) => t - times[i]).filter((d) => d > 0);
  if (steps.length === 0) return [];
  const sorted = [...steps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const out: [number, number][] = [];
  for (let i = 1; i < times.length; i++) {
    const d = times[i] - times[i - 1];
    if (d > Math.max(minS, factor * median)) out.push([times[i - 1], times[i]]);
  }
  return out;
}
