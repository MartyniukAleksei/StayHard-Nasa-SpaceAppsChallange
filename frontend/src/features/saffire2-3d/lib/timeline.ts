// Series timeline: the nine recordings on one clock. Playback time runs 1:1 with onboard time
// inside a recording; long pauses between recordings are squeezed to GAP_PLAY_S (marked on the
// timeline as a break). No imports from "@/": runs under node --test.

export const GAP_PLAY_S = 15;

export type Recording = {
  id: string;
  epochStart: number; // ms
  epochEnd: number; // ms
  ignitionEpoch: number | null; // ms
};

export type Segment = Recording & { p0: number; p1: number };
export type Gap = { p0: number; p1: number; realS: number };
export type SeriesTimeline = { segments: Segment[]; gaps: Gap[]; total: number; epoch0: number };

export function buildTimeline(recs: Recording[], gapPlay = GAP_PLAY_S): SeriesTimeline {
  const sorted = [...recs].sort((a, b) => a.epochStart - b.epochStart);
  const segments: Segment[] = [];
  const gaps: Gap[] = [];
  let p = 0;
  sorted.forEach((r, i) => {
    if (i > 0) {
      const realS = (r.epochStart - sorted[i - 1].epochEnd) / 1000;
      const play = Math.max(0, Math.min(realS, gapPlay));
      if (play > 0) gaps.push({ p0: p, p1: p + play, realS });
      p += play;
    }
    const len = (r.epochEnd - r.epochStart) / 1000;
    segments.push({ ...r, p0: p, p1: p + len });
    p += len;
  });
  return { segments, gaps, total: p, epoch0: sorted[0]?.epochStart ?? 0 };
}

export type Moment = {
  /** recording under the cursor, or null in a pause between recordings */
  segment: Segment | null;
  /** onboard time (epoch ms); inside a squeezed pause it is interpolated */
  epoch: number;
  /** seconds from ignition of the current recording */
  tIgn: number | null;
};

export function momentAt(tl: SeriesTimeline, p: number): Moment {
  for (const s of tl.segments) {
    if (p >= s.p0 && p <= s.p1) {
      const epoch = s.epochStart + (p - s.p0) * 1000;
      return { segment: s, epoch, tIgn: s.ignitionEpoch == null ? null : (epoch - s.ignitionEpoch) / 1000 };
    }
  }
  const gap = tl.gaps.find((g) => p > g.p0 && p < g.p1);
  if (gap) {
    const before = tl.segments.filter((s) => s.p1 <= gap.p0).pop();
    const f = (p - gap.p0) / (gap.p1 - gap.p0);
    const epoch = (before?.epochEnd ?? tl.epoch0) + f * gap.realS * 1000;
    return { segment: null, epoch, tIgn: null };
  }
  const last = tl.segments[tl.segments.length - 1];
  return { segment: null, epoch: last ? last.epochEnd : tl.epoch0, tIgn: null };
}

/** Playback position of a recording's ignition (or its start), for "jump to sample". */
export function ignitionPos(tl: SeriesTimeline, id: string, lead = 3): number {
  const s = tl.segments.find((x) => x.id === id);
  if (!s) return 0;
  if (s.ignitionEpoch == null) return s.p0;
  return Math.max(s.p0, s.p0 + (s.ignitionEpoch - s.epochStart) / 1000 - lead);
}
