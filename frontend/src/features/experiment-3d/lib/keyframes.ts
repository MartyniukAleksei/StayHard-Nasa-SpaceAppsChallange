export interface Keyframe {
  /** Frame index in the camera archive. */
  i: number;
  /** Seconds from ignition. */
  t: number;
}

/** Time of every frame in seconds from ignition. NaN where the index has no timestamp. */
export function frameTimes(startTimeIso: string, tMs: (number | null)[], ignitionEpochMs: number): number[] {
  const start = Date.parse(`${startTimeIso}Z`) - ignitionEpochMs;
  return tMs.map((ms) => (ms == null ? NaN : (start + ms) / 1000));
}

export function keyframeStep(tMin: number, tMax: number, minStep: number, maxCount: number): number {
  return Math.max(minStep, (tMax - tMin) / maxCount);
}

/** The frame nearest to each time mark tMin, tMin + step, … Long tests get sparser frames. */
export function pickKeyframes(times: number[], tMin: number, tMax: number, step: number): Keyframe[] {
  const out: Keyframe[] = [];
  let i = 0;
  for (let mark = tMin; mark <= tMax; mark += step) {
    while (i < times.length - 1 && Math.abs(times[i + 1] - mark) <= Math.abs(times[i] - mark)) i++;
    if (Number.isNaN(times[i]) || Math.abs(times[i] - mark) > step) continue;
    if (out.at(-1)?.i !== i) out.push({ i, t: times[i] });
  }
  return out;
}

/** Loading order: the keyframe nearest to each of `times` first (a tour's moments), then the rest
 *  in their own order. */
export function prioritize<K extends Keyframe>(keyframes: K[], times: number[]): K[] {
  const first: K[] = [];
  for (const t of times) {
    const kf = nearestKeyframe(keyframes, t);
    if (kf && !first.includes(kf)) first.push(kf);
  }
  return [...first, ...keyframes.filter((kf) => !first.includes(kf))];
}

/** The loaded keyframe closest in time to t. */
export function nearestKeyframe<K extends Keyframe>(loaded: K[], t: number): K | null {
  let best: K | null = null;
  for (const kf of loaded) {
    if (!best || Math.abs(kf.t - t) < Math.abs(best.t - t)) best = kf;
  }
  return best;
}
