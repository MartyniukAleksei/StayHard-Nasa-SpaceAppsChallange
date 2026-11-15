// Pure helpers for the Saffire-II charts (no imports from "@/": runs under node --test).

export type Num = number | null;
export type Pt = [number, number];

/** Zip time with values, dropping gaps. */
export function points(t: number[], v: Num[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < t.length; i++) {
    const y = v[i];
    if (y != null && Number.isFinite(y)) out.push([t[i], y]);
  }
  return out;
}

/** Per-sample maximum across several aligned series (e.g. the hottest of TC7–TC12). */
export function maxAcross(rows: Num[][]): Num[] {
  const n = Math.max(0, ...rows.map((r) => r.length));
  const out: Num[] = [];
  for (let i = 0; i < n; i++) {
    let m: Num = null;
    for (const r of rows) {
      const v = r[i];
      if (v != null && (m == null || v > m)) m = v;
    }
    out.push(m);
  }
  return out;
}

/** Value minus its value at (the first sample at or after) t = 0. */
export function riseFromZero(t: number[], v: Num[]): Num[] {
  const i0 = t.findIndex((x) => x >= 0);
  const base = i0 >= 0 ? v[i0] : null;
  return v.map((x) => (x == null || base == null ? null : x - base));
}

/** Min/max of the finite values, padded; [0, 1] when empty. */
export function domain(values: Num[], pad = 0.05): [number, number] {
  const f = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (f.length === 0) return [0, 1];
  const lo = Math.min(...f);
  const hi = Math.max(...f);
  const span = hi - lo || Math.abs(hi) || 1;
  return [lo - span * pad, hi + span * pad];
}

/**
 * Heat map cells: `bins` time columns per row, each the max of the row in that bin.
 * Returns the grid plus the overall min/max used for the colour scale.
 */
export function heatGrid(t: number[], rows: Num[][], bins: number, range?: [number, number]) {
  const [t0, t1] = range ?? [t[0] ?? 0, t[t.length - 1] ?? 1];
  const w = (t1 - t0) / bins || 1;
  const grid: Num[][] = rows.map(() => Array.from({ length: bins }, () => null as Num));
  let lo = Infinity;
  let hi = -Infinity;
  t.forEach((x, i) => {
    const b = Math.min(bins - 1, Math.floor((x - t0) / w));
    if (b < 0) return;
    rows.forEach((r, k) => {
      const v = r[i];
      if (v == null) return;
      const cur = grid[k][b];
      if (cur == null || v > cur) grid[k][b] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    });
  });
  return { grid, lo: Number.isFinite(lo) ? lo : 0, hi: Number.isFinite(hi) ? hi : 1 };
}

/** Quantise v in [lo, hi] into `steps` levels 0…steps-1 (raster look, no gradients). */
export function level(v: number, lo: number, hi: number, steps = 6): number {
  if (hi <= lo) return 0;
  const x = (v - lo) / (hi - lo);
  return Math.max(0, Math.min(steps - 1, Math.floor(x * steps)));
}

/** Log-scale position in [0, 1] for v between lo and hi (both > 0). */
export function logPos(v: number, lo: number, hi: number): number {
  const p = (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
  return Math.max(0, Math.min(1, p));
}

/** Percent by volume → ppm (display unit only): 0.33 % → 3300 ppm. */
export const toPpm = (v: Num): Num => (v == null ? null : Math.round(v * 10000));

/** Highest point of a series (for placing its label); [0, 0] when empty. */
export const peakOf = (pts: Pt[]): Pt => pts.reduce((m, p) => (p[1] > m[1] ? p : m), pts[0] ?? [0, 0]);

