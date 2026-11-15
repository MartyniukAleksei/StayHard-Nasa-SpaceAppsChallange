// Copied from frontend/src/features/experiment-3d/lib/series.ts (only the import path differs); the prototype app cannot import the frontend.
// shortcut: a copy, not a shared module; replace with frontend/src/shared/three when the scene moves into frontend/.
import type { TimeSeries } from "../types.ts";

/** A time series as columns, for fast linear interpolation over time. */
export interface Track {
  t: Float64Array;
  cols: Record<string, Float64Array>;
  t0: number;
  t1: number;
}

export function toTrack(ts: TimeSeries | null): Track | null {
  if (!ts) return null;
  const ti = ts.columns.indexOf("t_s");
  const rows = ts.rows.filter((r) => r[ti] != null).sort((a, b) => (a[ti] as number) - (b[ti] as number));
  if (rows.length < 2) return null;
  const t = Float64Array.from(rows, (r) => r[ti] as number);
  const cols: Record<string, Float64Array> = {};
  ts.columns.forEach((name, c) => {
    if (c === ti) return;
    // gaps take the previous value so interpolation never yields NaN
    let last = (rows.find((r) => r[c] != null)?.[c] as number | undefined) ?? 0;
    cols[name] = Float64Array.from(rows, (r) => (last = (r[c] as number | null) ?? last));
  });
  return { t, cols, t0: t[0], t1: t[t.length - 1] };
}

/** Column value at time t. Outside the data range: null, or the edge value when clamp is set. */
export function sample(track: Track | null, col: string, t: number, clamp = false): number | null {
  if (!track) return null;
  const v = track.cols[col];
  if (!v) return null;
  if (t <= track.t0) return clamp || t === track.t0 ? v[0] : null;
  if (t >= track.t1) return clamp || t === track.t1 ? v[v.length - 1] : null;
  let lo = 0;
  let hi = track.t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track.t[mid] <= t) lo = mid;
    else hi = mid;
  }
  const f = (t - track.t[lo]) / (track.t[hi] - track.t[lo] || 1);
  return v[lo] + (v[hi] - v[lo]) * f;
}

/** 0..1: fade in at the start of the series and out at its end (looks only, not data). */
export function presence(track: Track | null, t: number, fadeIn = 0.25, fadeOut = 0.3): number {
  if (!track || t < track.t0 || t > track.t1) return 0;
  return Math.min(1, (t - track.t0) / fadeIn, (track.t1 - t) / fadeOut);
}
