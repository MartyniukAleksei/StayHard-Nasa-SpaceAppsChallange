import { sample, toTrack, type Track } from "./series.ts";
import type { Source, TemArchive, TestDetail, TestRow, TimeSeries } from "../types.ts";

/** P-Trak upper limit: a reading of exactly this value means "at least" (docs/data/same_r.md §4). */
export const PTRAK_LIMIT = 500_000;
/** Reference alarm level for smoke mass, mg/m³ (CMD 500 nm, σg 1.3): SAME-2 comparison slides 25–26. */
export const MASS_ALARM_MG_M3 = 2;

export const DETECTOR_LABELS: Record<string, string> = {
  iss_scatter_v: "ISS detector · light scatter",
  iss_obscuration_v: "ISS detector · obscuration",
  sts_v: "STS detector · ionization",
  ion_a_v: "Ion detector A",
  ion_b_v: "Ion detector B",
};

export interface Detector {
  col: string;
  label: string;
  /** Median reading before the heater turns on, volts. */
  rest: number;
}

/**
 * Gauge axis, volts of change from the pre-heating level. One fixed scale for every detector and
 * test, so a weak response looks weak. 6 V: the ISS scatter channel bottoms out about 6.1 V below
 * its rest level in the strongest tests of the snapshot. A display axis, not an alarm level.
 */
export const DETECTOR_FULL_SCALE_V = 6;
/** A detector that rests above 1 V and reads within this of 0 V gives no signal (estimate: not powered). */
const NO_SIGNAL_V = 0.05;

export interface Experiment {
  test: TestRow; // conditions come from the table row, not from descriptions
  aged: TestRow | null; // the `Na` row: the same smoke measured after aging
  hkp: Track; // 1 Hz telemetry; t_s = 0 is the first row with heating == 1
  tMin: number;
  tMax: number;
  heaterOff: number | null; // first row after t = 0 with heating == 0
  ptrakPeak: { t: number; perCc: number } | null; // from the API coverage (derived from ts_sensors)
  detectors: Detector[]; // only coverage.active_detectors
  ohmMax: number;
  plumeMin: number;
  plumeMax: number;
  hasMass: boolean; // DustTrak B has at least one value
  massMax: number;
  tem: TemArchive[];
  doi: Source | null;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const max = (xs: Float64Array) => xs.reduce((m, v) => (v > m ? v : m), -Infinity);
const min = (xs: Float64Array) => xs.reduce((m, v) => (v < m ? v : m), Infinity);

/** null: no telemetry for the test, nothing to replay. */
export function buildExperiment(detail: TestDetail, series: TimeSeries | null): Experiment | null {
  const hkp = toTrack(series);
  if (!hkp || !series) return null;
  const test = detail.rows.find((r) => r.test_id === String(detail.test_no)) ?? detail.rows[0];
  if (!test) return null;

  const heating = hkp.cols.heating;
  let heaterOff: number | null = null;
  for (let i = 0; i < hkp.t.length; i++) {
    if (hkp.t[i] > 0 && heating[i] < 0.5) {
      heaterOff = hkp.t[i];
      break;
    }
  }

  const detectors = (detail.coverage?.active_detectors ?? [])
    .filter((col) => col in DETECTOR_LABELS && hkp.cols[col])
    .map((col) => {
      const v = hkp.cols[col];
      const before = Array.from(v).filter((_, i) => hkp.t[i] < 0);
      const rest = before.length ? median(before) : v[0];
      return { col, label: DETECTOR_LABELS[col], rest };
    });

  const mi = series.columns.indexOf("dusttrak_b_mg_m3");
  const cov = detail.coverage;
  return {
    test,
    aged: detail.rows.find((r) => r.test_id === `${detail.test_no}a`) ?? null, // not a duplicate test number
    hkp,
    tMin: hkp.t0,
    tMax: hkp.t1,
    heaterOff,
    ptrakPeak:
      cov?.ptrak_peak_t_s != null && cov.ptrak_peak_per_cc != null
        ? { t: cov.ptrak_peak_t_s, perCc: cov.ptrak_peak_per_cc }
        : null,
    detectors,
    ohmMax: max(hkp.cols.sample_ohm),
    plumeMin: min(hkp.cols.plume_c),
    plumeMax: max(hkp.cols.plume_c),
    hasMass: mi >= 0 && series.rows.some((r) => r[mi] != null),
    massMax: mi >= 0 ? max(hkp.cols.dusttrak_b_mg_m3) : 0,
    tem: detail.tem_archives,
    doi: detail.sources.find((s) => s.url.startsWith("https://doi.org/")) ?? null,
  };
}

/** Reading at the 1 Hz sample nearest to t, so the readout shows values exactly as in the CSV. */
export function reading(e: Experiment, col: string, t: number): number | null {
  return sample(e.hkp, col, Math.round(t));
}

export const heaterOn = (e: Experiment, t: number) => (reading(e, "heating", t) ?? 0) >= 0.5;

/** 0..1 position of a smoke mass on the 0.01 … 1000 mg/m³ log scale. */
export function massFraction(mgM3: number | null): number {
  if (mgM3 == null || mgM3 <= 0.01) return 0;
  return Math.min(1, (Math.log10(mgM3) + 2) / 5);
}

/** 0..1 share of haze points drawn for a particle count. The log mapping is illustrative. */
export function hazeFraction(perCc: number | null): number {
  if (perCc == null || perCc <= 0) return 0;
  return Math.min(1, Math.log10(1 + perCc / 500) / Math.log10(1 + PTRAK_LIMIT / 500));
}

/**
 * Change from the pre-heating level, volts. null: no reading, or the detector gives no signal
 * (STS in #89 sits at 0 V before it is switched on and after it is switched off, at 5.1 V between).
 */
export function detectorChange(d: Detector, v: number | null): number | null {
  if (v == null || (Math.abs(d.rest) > 1 && Math.abs(v) < NO_SIGNAL_V)) return null;
  return v - d.rest;
}

/** 0..1 gauge bar on the fixed DETECTOR_FULL_SCALE_V axis. */
export function detectorFraction(d: Detector, v: number | null): number {
  const change = detectorChange(d, v);
  return change == null ? 0 : Math.min(1, Math.abs(change) / DETECTOR_FULL_SCALE_V);
}
