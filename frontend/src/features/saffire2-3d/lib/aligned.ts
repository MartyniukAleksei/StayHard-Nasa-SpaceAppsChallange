// "Side by side": the nine recordings on one clock that counts seconds from each sample's own
// ignition, so all strips are lit at t = 0 together. In flight they burned one after another;
// the scene says so whenever this mode is on. No imports from "@/": runs under node --test.
import type { Recording } from "./timeline.ts";

export type AlignedWindow = {
  id: string;
  /** recording start and end, seconds from this sample's ignition */
  from: number;
  to: number;
  ignited: boolean;
};

export type AlignedClock = { windows: AlignedWindow[]; tMin: number; tMax: number };

/** Recording windows relative to ignition. A recording without ignition starts at t = 0. */
export function buildAligned(recs: Recording[]): AlignedClock {
  const windows = recs.map((r) => {
    const zero = r.ignitionEpoch ?? r.epochStart;
    return { id: r.id, from: (r.epochStart - zero) / 1000, to: (r.epochEnd - zero) / 1000, ignited: r.ignitionEpoch != null };
  });
  if (windows.length === 0) return { windows, tMin: 0, tMax: 0 };
  return {
    windows,
    tMin: Math.min(...windows.map((w) => w.from)),
    tMax: Math.max(...windows.map((w) => w.to)),
  };
}

/**
 * Seconds from ignition for one sample at aligned time t: the same t while its recording runs,
 * `Infinity` after it ended (final table state), `null` before it started or without a recording.
 */
export function alignedTIgn(clock: AlignedClock, id: string, t: number): number | null {
  const w = clock.windows.find((x) => x.id === id);
  if (!w) return null;
  if (t > w.to) return Infinity;
  if (t < w.from) return null;
  return t;
}
