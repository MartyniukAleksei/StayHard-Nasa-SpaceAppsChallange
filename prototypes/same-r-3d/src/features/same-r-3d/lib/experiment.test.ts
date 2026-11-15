import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExperiment, detectorChange, detectorFraction, hazeFraction, heaterOn, PTRAK_LIMIT, reading } from "./experiment.ts";
import type { TestDetail, TimeSeries } from "../types.ts";

const columns = ["t_s", "heating", "sample_ohm", "plume_c", "ptrak_per_cc", "dusttrak_b_mg_m3", "ion_b_v", "sts_v"];
const rows: (number | null)[][] = [
  [-2, 0, 0.6, 25, 0, null, 4.8, 0],
  [-1, 0, 0.6, 25, 0, null, 4.8, 0],
  [0, 1, 0.7, 26, 0, null, 4.8, 0],
  [1, 1, 0.9, 41, 100, null, 5.0, 0],
  [2, 0, 0.5, 60, PTRAK_LIMIT, null, 5.8, 0],
  [3, 0, 0.4, 50, 2000, null, 5.3, 0],
];
const series = (r = rows): TimeSeries => ({ test_no: 73, signal: "hkp", columns, rows: r, n_total: r.length, sources: [] });
const row = (test_id: string) => ({
  test_no: 73, test_id, material: "Kapton", description: null, date_2010: null, inlet_velocity_cm_s: 8.1,
  heater_rt_r0: 1.38, heating_s: 60, net_aging_s: 33, has_timeseries: true,
});
const detail: TestDetail = {
  test_no: 73,
  rows: [row("73"), row("73a")],
  coverage: { t_min: -2, t_max: 3, ptrak_peak_per_cc: PTRAK_LIMIT, ptrak_peak_t_s: 2, active_detectors: ["ion_b_v"] },
  tem_archives: [],
  sources: [{ url: "https://doi.org/10.60555/2np7-jv14", title: "d", text: "d" }],
};

test("no telemetry: nothing to replay", () => {
  assert.equal(buildExperiment(detail, null), null);
  assert.equal(buildExperiment(detail, series([rows[0]])), null);
});

test("range, heater-off moment and table rows come from the data", () => {
  const e = buildExperiment(detail, series())!;
  assert.deepEqual([e.tMin, e.tMax, e.heaterOff], [-2, 3, 2]);
  assert.equal(e.test.test_id, "73");
  assert.equal(e.aged?.test_id, "73a");
  assert.equal(e.doi?.url, "https://doi.org/10.60555/2np7-jv14");
});

test("readout snaps to the 1 Hz sample and is null outside the series", () => {
  const e = buildExperiment(detail, series())!;
  assert.equal(reading(e, "plume_c", 1.4), 41);
  assert.equal(reading(e, "ptrak_per_cc", 2.2), PTRAK_LIMIT);
  assert.equal(reading(e, "plume_c", 9), null);
  assert.equal(heaterOn(e, 0.6), true);
  assert.equal(heaterOn(e, 2), false);
});

test("only active detectors, on one fixed volt scale from their pre-heating level", () => {
  const e = buildExperiment(detail, series())!;
  assert.deepEqual(e.detectors.map((d) => d.col), ["ion_b_v"]); // sts_v is flat in this test: not shown
  const [d] = e.detectors;
  assert.equal(d.rest, 4.8);
  assert.ok(Math.abs(detectorChange(d, 5.8)! - 1) < 1e-9);
  assert.ok(Math.abs(detectorFraction(d, 5.8) - 1 / 6) < 1e-9); // a 1 V change is a sixth of the bar in any test
  assert.equal(detectorFraction(d, 4.8 - 7), 1); // clipped at the end of the axis
  assert.equal(detectorFraction(d, 4.8), 0);
  assert.equal(detectorFraction(d, null), 0);
  // a detector that rests at 4.8 V and reads 0 V is not powered: no signal, not a full bar
  assert.equal(detectorChange(d, 0.001), null);
  assert.equal(detectorFraction(d, 0.001), 0);
});

test("an all-empty DustTrak column is 'no data', not zero", () => {
  assert.equal(buildExperiment(detail, series())!.hasMass, false);
  const withMass = rows.map((r, i) => r.map((v, c) => (c === 5 ? i * 0.5 : v)));
  const e = buildExperiment(detail, series(withMass))!;
  assert.equal(e.hasMass, true);
  assert.equal(e.massMax, 2.5);
});

test("haze fraction: none without particles, full at the P-Trak limit", () => {
  assert.equal(hazeFraction(0), 0);
  assert.equal(hazeFraction(null), 0);
  assert.equal(hazeFraction(PTRAK_LIMIT), 1);
  assert.ok(hazeFraction(1000) < hazeFraction(100000));
});
