// Dashboard + nine sensor series → the model the scene and HUD read every frame.
import type { SaffireDashboard, SaffireSample, SaffireSeries } from "@/features/saffire2";
import { alignedTIgn, buildAligned, type AlignedClock } from "./aligned";
import { burnAt, type BurnInput, type BurnState } from "./burn";
import { buildTimeline, momentAt, type Moment, type SeriesTimeline } from "./timeline";

type Num = number | null;

export type Track = { t: number[]; v: Num[] };

export type SceneSample = {
  id: string;
  index: number; // 1…9, position on the card (Readme Fig. 1)
  sample: SaffireSample;
  burn: BurnInput;
  igniter: Track | null; // A
  radiometer: Track | null; // max of the four, baseline removed, mW/cm²
  radiometerPeak: number; // max over the flame window, for normalising brightness
  flow: Track | null; // anemometer 1, cm/s
  co2: Track | null; // module CO₂, ppm (1 Hz, from this recording)
  igniterAtTop: boolean; // Readme Table 1: S4 igniter downstream
};

export type SaffireModel = {
  samples: SceneSample[];
  timeline: SeriesTimeline;
  /** the same recordings aligned at ignition ("side by side" mode) */
  aligned: AlignedClock;
  co2: { minutes: number; ppm: number }[]; // module CO₂, minutes from the first recording
  doi: string;
};

/** Linear interpolation inside the track; null outside it or across a gap. */
export function valueAt(track: Track | null, t: number): number | null {
  if (!track || track.t.length === 0) return null;
  const ts = track.t;
  if (t < ts[0] || t > ts[ts.length - 1]) return null;
  let lo = 0;
  let hi = ts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  const a = track.v[lo];
  const b = track.v[hi];
  if (a == null || b == null) return a ?? b;
  const f = (t - ts[lo]) / (ts[hi] - ts[lo] || 1);
  return a + (b - a) * f;
}

const maxOf = (rows: Num[][]): Num[] =>
  (rows[0] ?? []).map((_, i) => {
    let m: Num = null;
    for (const r of rows) if (r[i] != null && (m == null || (r[i] as number) > m)) m = r[i];
    return m;
  });

export function buildModel(dash: SaffireDashboard, series: SaffireSeries[]): SaffireModel | null {
  const byId = new Map(series.map((s) => [s.test_id, s]));
  const samples: SceneSample[] = [];
  for (const s of dash.samples) {
    const ser = byId.get(s.test_id);
    const rad = ser ? maxOf(ser.radiometers) : null;
    const burnEnd = s.burn_time_s ?? 0;
    // peak radiation while the flame burns (skip the igniter's own flash in the first ~10 s)
    const peak = ser && rad ? Math.max(1, ...rad.filter((v, i) => v != null && ser.t[i] > 12 && ser.t[i] <= burnEnd).map(Number)) : 1;
    samples.push({
      id: s.test_id,
      index: Number(s.test_id.split("-")[1]),
      sample: s,
      burn: {
        material: s.material,
        burnTimeS: s.burn_time_s,
        ugBurnCm: s.ug_burn_cm,
        spreadLo: s.ug_spread.lo,
        spreadHi: s.ug_spread.hi,
        spreadNote: s.ug_spread.note,
      },
      igniter: ser ? { t: ser.t, v: ser.igniter_a } : null,
      radiometer: ser && rad ? { t: ser.t, v: rad } : null,
      radiometerPeak: peak,
      flow: ser ? { t: ser.t, v: ser.anemometer_1 } : null,
      co2: ser ? { t: ser.t, v: ser.co2_pct.map((v) => (v == null ? null : v * 10000)) } : null,
      igniterAtTop: s.flow_direction === "opposed",
    });
  }
  const recs = dash.samples
    .filter((s) => s.sensors)
    .map((s) => ({
      id: s.test_id,
      epochStart: s.sensors!.epoch_start_ms,
      epochEnd: s.sensors!.epoch_end_ms,
      ignitionEpoch: s.sensors!.ignition_epoch_ms,
    }));
  if (recs.length === 0) return null;
  const co2 = dash.co2_timeline.flatMap((c) => c.points.map(([m, v]) => ({ minutes: m, ppm: Math.round(v * 10000) })));
  co2.sort((a, b) => a.minutes - b.minutes);
  return { samples, timeline: buildTimeline(recs), aligned: buildAligned(recs), co2, doi: dash.about.doi };
}

export type SampleNow = {
  s: SceneSample;
  active: boolean;
  tIgn: number | null;
  igniterOn: boolean;
  burn: BurnState;
  brightness: number; // 0…1 from the radiometers (data), 0 without a flame
};

/** One sample at `tIgn` seconds from its ignition; `active` = its recording is running. */
function sampleNow(s: SceneSample, active: boolean, tIgn: number | null): SampleNow {
  const burn = burnAt(s.burn, tIgn);
  // series time is already seconds from ignition (backend: t = t_s − ignition_t_s)
  const amps = active && tIgn != null ? valueAt(s.igniter, tIgn) : null;
  const rad = active && tIgn != null ? valueAt(s.radiometer, tIgn) : null;
  const brightness = burn.flame ? Math.max(0.25, Math.min(1, (rad ?? 0) / s.radiometerPeak)) : 0;
  return { s, active, tIgn, igniterOn: amps != null && amps > 0.5, burn, brightness };
}

/** State of every sample at playback position p ("as flown": one recording after another). */
export function stateAt(model: SaffireModel, p: number): { moment: Moment; samples: SampleNow[] } {
  const moment = momentAt(model.timeline, p);
  const samples = model.samples.map((s) => {
    const seg = model.timeline.segments.find((x) => x.id === s.id);
    const active = moment.segment?.id === s.id;
    let tIgn: number | null = null;
    if (active) tIgn = moment.tIgn;
    else if (seg && moment.epoch > seg.epochEnd) tIgn = Infinity;
    return sampleNow(s, active, tIgn);
  });
  return { moment, samples };
}

/** State of every sample at t seconds from ignition, all nine aligned ("side by side"). */
export function stateAligned(model: SaffireModel, t: number): SampleNow[] {
  return model.samples.map((s) => {
    const tIgn = alignedTIgn(model.aligned, s.id, t);
    return sampleNow(s, tIgn != null && Number.isFinite(tIgn), tIgn);
  });
}

export type ClockMode = "aligned" | "series";

/** The samples the scene draws at playback time t in either mode. */
export function samplesAt(model: SaffireModel, mode: ClockMode, t: number): SampleNow[] {
  return mode === "aligned" ? stateAligned(model, t) : stateAt(model, t).samples;
}

/** Module CO₂ (ppm) at an onboard time; null outside the recordings. */
export function co2At(model: SaffireModel, epoch: number): number | null {
  const m = (epoch - model.timeline.epoch0) / 60000;
  const pts = model.co2;
  if (pts.length === 0 || m < pts[0].minutes || m > pts[pts.length - 1].minutes) return null;
  let i = 0;
  while (i + 1 < pts.length && pts[i + 1].minutes <= m) i++;
  // no value across a pause between recordings (> 1 min without points)
  const next = pts[i + 1];
  if (next && next.minutes - pts[i].minutes > 1) return m - pts[i].minutes < 0.2 ? pts[i].ppm : null;
  return pts[i].ppm;
}
