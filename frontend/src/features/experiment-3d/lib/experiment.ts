import type { TestDetail } from "@/features/flex-tests";
import type { TimeSeries } from "../types";
import type { ApparatusEvents, LogTiming } from "./log";
import { sample, toTrack, type Track } from "./series";

export interface Experiment {
  test: TestDetail;
  droplet: Track;
  flameUv: Track | null;
  flameColor: Track | null;
  /** Onboard time of t_s = 0, ms since the UTC epoch. null: the test has no log. */
  ignitionEpochMs: number | null;
  events: ApparatusEvents;
  /** Where the needles released the droplet (first data point), mm. */
  deploySite: [number, number, number];
  tMin: number;
  tMax: number;
  /** End of the flame data = the moment the visible / UV flame went out. */
  flameEnd: number | null;
}

export interface SeriesSet {
  droplet: TimeSeries | null;
  flameUv: TimeSeries | null;
  flameColor: TimeSeries | null;
}

const NO_TIMING: LogTiming = {
  ignitionEpochMs: null,
  events: { needlesRetract: null, igniterOn: null, igniterRetracted: null },
};

/** null when the test has no droplet series: there is nothing to replay. */
export function buildExperiment(test: TestDetail, series: SeriesSet, timing: LogTiming | null): Experiment | null {
  const droplet = toTrack(series.droplet);
  if (!droplet) return null;
  const flameUv = toTrack(series.flameUv);
  const flameColor = toTrack(series.flameColor);
  const { ignitionEpochMs, events } = timing ?? NO_TIMING;

  const ends = [flameUv?.t1, flameColor?.t1].filter((v): v is number => v != null);
  const flameEnd = ends.length ? Math.max(...ends) : null;
  // start one second before the needles let go: the droplet still hangs between them
  const firstEvent = Math.min(droplet.t0, events.needlesRetract ?? Infinity, events.igniterOn ?? Infinity);

  const experiment: Experiment = {
    test,
    droplet,
    flameUv,
    flameColor,
    ignitionEpochMs,
    events,
    deploySite: [0, 0, 0],
    tMin: firstEvent - 1,
    tMax: Math.max(droplet.t1, flameEnd ?? droplet.t1) + 1.2,
    flameEnd,
  };
  experiment.deploySite = dropletPosition(experiment, droplet.t0);
  return experiment;
}

/** Droplet position, mm: x, y from HiBMS (ts_droplet), z from the UV camera (ts_flame_uv). An estimate
 *  that combines two camera views. */
export function dropletPosition(e: Experiment, t: number): [number, number, number] {
  return [
    sample(e.droplet, "x_mm", t, true) ?? 0,
    sample(e.droplet, "y_mm", t, true) ?? 0,
    sample(e.flameUv, "droplet_z_mm", t, true) ?? 0,
  ];
}

export function maxFlameDiameter(e: Experiment): number {
  return Math.max(
    20,
    ...Array.from(e.flameUv?.cols.flame_d_mm ?? []),
    ...Array.from(e.flameColor?.cols.flame_d_mm ?? []),
  );
}
