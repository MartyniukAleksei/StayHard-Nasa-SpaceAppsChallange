import type { Replay, SeriesPoint } from "../types";

/** Minimum flame diameter (mm) we still treat as a visible flame. */
const MIN_FLAME_MM = 0.1;

/** Linear interpolation inside the series; null outside its time range. */
export function interp(series: SeriesPoint[], t: number): number | null {
  if (series.length === 0) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (t < first[0] || t > last[0]) return null;
  for (let i = 1; i < series.length; i++) {
    const [t1, v1] = series[i];
    if (t1 >= t) {
      const [t0, v0] = series[i - 1];
      const span = t1 - t0 || 1;
      return v0 + ((v1 - v0) * (t - t0)) / span;
    }
  }
  return last[1];
}

export type Frame = { t: number; dropletMm: number | null; flameMm: number | null };

/** What the replay shows at time t: measured droplet and flame diameters. */
export function frameAt(r: Replay, t: number): Frame {
  const dropletMm = interp(r.droplet, t);
  const f = interp(r.flame, t);
  const burning = r.burn_time_s == null || t <= r.burn_time_s;
  const flameMm = f != null && f > MIN_FLAME_MM && burning ? f : null;
  return { t, dropletMm, flameMm };
}

export function duration(r: Replay): number {
  const ends = [r.droplet.at(-1)?.[0] ?? 0, r.flame.at(-1)?.[0] ?? 0, r.burn_time_s ?? 0];
  return Math.max(...ends);
}

/** Largest diameter in the test, used to fit the scene into the frame. */
export function maxDiameter(r: Replay): number {
  const all = [...r.droplet, ...r.flame].map((p) => p[1]);
  return Math.max(1, ...all);
}
