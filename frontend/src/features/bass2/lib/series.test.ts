import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { TestRow, VideoSeries } from "../types";
import { coVsCo2, flameOutAt, numbers, o2VsCo2, seriesColumn, slopeThroughOrigin, zeroFlowAt, type Pt } from "./series.ts";

const ramp = (n: number, f: (t: number) => number): Pt[] => Array.from({ length: n }, (_, t) => [t, f(t)]);

describe("video series helpers", () => {
  test("seriesColumn skips missing values", () => {
    const s = { columns: ["t_s", "air_cm_s"], points: [[0, 5], [1, null], [2, 3]] } as VideoSeries;
    assert.deepEqual(seriesColumn(s, "air_cm_s"), [[0, 5], [2, 3]]);
    assert.deepEqual(seriesColumn(s, "nope"), []);
  });
  test("zeroFlowAt waits for a steady zero", () => {
    const air = ramp(200, (t) => (t < 50 ? 5 : t < 55 ? 0 : t < 60 ? 2 : 0));
    assert.equal(zeroFlowAt(air), 60);
    assert.equal(zeroFlowAt(ramp(100, () => 3)), null);
  });
  test("flameOutAt finds the last bright moment before a long dark stretch, even near the end", () => {
    const scene = ramp(300, (t) => (t < 120 ? 500 : t < 125 ? 50 : t < 130 ? 400 : 5));
    assert.equal(flameOutAt(scene), 129);
    const short = ramp(150, (t) => (t < 120 ? 500 : 5)); // only 30 s left after the flame
    assert.equal(flameOutAt(short), 119);
    assert.equal(flameOutAt(ramp(100, () => 500)), null);
  });
});

describe("gas balance helpers", () => {
  const row = (o: Partial<TestRow>) => ({ co_over_range: false, o2_final_suspect: false, ...o }) as TestRow;
  test("deltas from start/end readings; bad readings dropped", () => {
    assert.deepEqual(coVsCo2(row({ co_initial_ppm: 10, co_final_ppm: 120, co2_initial_pct: 0.4, co2_final_pct: 0.6 }))?.[1], 110);
    assert.equal(coVsCo2(row({ co_initial_ppm: 10, co_final_ppm: 120, co2_initial_pct: 0.4, co2_final_pct: 0.6, co_over_range: true })), null);
    assert.deepEqual(o2VsCo2(row({ o2_initial_pct: 21, o2_final_pct: 20.4, co2_initial_pct: 0.4, co2_final_pct: 0.9 })), [0.5, 0.6000000000000014]);
    assert.equal(o2VsCo2(row({ o2_initial_pct: 21, o2_final_pct: 39, co2_initial_pct: 0.4, co2_final_pct: 0.9, o2_final_suspect: true })), null);
  });
  test("slope through the origin and numbers from report strings", () => {
    assert.equal(slopeThroughOrigin([[1, 2], [2, 4]]), 2);
    assert.equal(slopeThroughOrigin([]), null);
    assert.deepEqual(numbers("~550 ppm CO per 1% CO₂ (concurrent rods), ~370 (opposed slabs)"), [550, 1, 370]);
  });
});
