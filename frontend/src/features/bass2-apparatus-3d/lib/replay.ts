// No runtime imports: node:test loads this file directly.
// A replay is driven by the 1 Hz series read from the overlay of the NASA video (video_series in the
// test report). Those numbers are an estimate (template OCR of the overlay), and the scene says so.

/** Mirror of the backend's video_series. */
export interface VideoSeries {
  psi_video_index: number | null;
  start_gmt: string;
  method: string;
  columns: string[];
  points: (number | null)[][];
}

/** One column as parallel arrays, missing values dropped. */
export interface Track {
  t: Float64Array;
  v: Float64Array;
}

export interface ReplayModel {
  /** cm/s, the air-speed display read from the overlay. */
  air: Track;
  /** ×10 V, the fan voltage display. */
  fan: Track | null;
  /** relative, uncalibrated radiometer. */
  rad: Track | null;
  /** count of pixels brighter than the static background: a flame-visibility proxy. */
  scene: Track;
  sceneMax: number;
  tMin: number;
  tMax: number;
  /** First time the air display reads 0 and stays there, s; null if it never does. */
  zeroFlowAt: number | null;
  /** First time the flame shows in the video (bright pixels at or above the level), s. */
  flameOnAt: number | null;
  /** Last time the flame shows before it stays below the level, s. */
  flameOutAt: number | null;
}

export function toTrack(s: VideoSeries, name: string): Track | null {
  const i = s.columns.indexOf(name);
  if (i < 0) return null;
  const t: number[] = [];
  const v: number[] = [];
  for (const p of s.points) {
    if (p[0] == null || p[i] == null) continue;
    t.push(p[0] as number);
    v.push(p[i] as number);
  }
  return t.length ? { t: Float64Array.from(t), v: Float64Array.from(v) } : null;
}

/**
 * Linear interpolation inside the record; null outside it. A gap longer than `maxGapS` is also null: the
 * overlay was unreadable there and nothing is drawn across it.
 */
export function sample(track: Track | null, t: number, maxGapS = 5): number | null {
  if (!track) return null;
  const { t: ts, v } = track;
  const n = ts.length;
  if (n === 0 || t < ts[0] || t > ts[n - 1]) return null;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  if (ts[lo] === t) return v[lo];
  if (ts[hi] - ts[lo] > maxGapS) return null;
  const k = (t - ts[lo]) / (ts[hi] - ts[lo]);
  return v[lo] + (v[hi] - v[lo]) * k;
}

/** First time `air` is ≤ eps and stays so for `hold` seconds of record. */
export function zeroFlowAt(air: Track, eps = 0.5, hold = 30): number | null {
  const n = air.t.length;
  for (let i = 0; i < n; i++) {
    if (air.v[i] > eps) continue;
    const t0 = air.t[i];
    if (air.t[n - 1] - t0 < hold) return null;
    let ok = true;
    for (let j = i; j < n && air.t[j] < t0 + hold; j++) {
      if (air.v[j] > eps) {
        ok = false;
        break;
      }
    }
    if (ok) return t0;
  }
  return null;
}

/** First time the bright-pixel count reaches `level`. */
export function flameOnAt(scene: Track, level: number): number | null {
  for (let i = 0; i < scene.t.length; i++) if (scene.v[i] >= level) return scene.t[i];
  return null;
}

/**
 * Last time the count is at or above `level` that is followed by at least `minQuiet` s (up to `quiet` s or the
 * end of the record) below it. Same rule as the overview cards.
 */
export function flameOutAt(scene: Track, level: number, quiet = 60, minQuiet = 20): number | null {
  const n = scene.t.length;
  for (let i = 0; i < n; i++) {
    if (scene.v[i] < level) continue;
    const t = scene.t[i];
    let span = 0;
    let allBelow = true;
    for (let j = i + 1; j < n && scene.t[j] <= t + quiet; j++) {
      span = scene.t[j] - t;
      if (scene.v[j] >= level) {
        allBelow = false;
        break;
      }
    }
    if (allBelow && span >= minQuiet) return t;
  }
  return null;
}

export function buildReplay(series: VideoSeries | null | undefined, level: number): ReplayModel | null {
  if (!series) return null;
  const air = toTrack(series, "air_cm_s");
  const scene = toTrack(series, "scene_px");
  if (!air || !scene) return null;
  let sceneMax = 0;
  for (const x of scene.v) sceneMax = Math.max(sceneMax, x);
  const tMin = Math.min(air.t[0], scene.t[0]);
  const tMax = Math.max(air.t[air.t.length - 1], scene.t[scene.t.length - 1]);
  if (!(tMax > tMin)) return null;
  return {
    air,
    fan: toTrack(series, "fan_display"),
    rad: toTrack(series, "rad_rel"),
    scene,
    sceneMax,
    tMin,
    tMax,
    zeroFlowAt: zeroFlowAt(air),
    flameOnAt: flameOnAt(scene, level),
    flameOutAt: flameOutAt(scene, level),
  };
}

/**
 * Flame presence 0..1 from the bright-pixel count: 0 below the level, then the count on a log scale against
 * the record's maximum. An estimate of brightness; the flame's shape is not in the data.
 */
export function visibility(px: number | null, level: number, max: number): number {
  if (px == null || px < level || max <= level) return 0;
  const k = Math.log10(px + 1 - level) / Math.log10(max + 1 - level);
  return 0.35 + 0.65 * Math.min(1, Math.max(0, k));
}
