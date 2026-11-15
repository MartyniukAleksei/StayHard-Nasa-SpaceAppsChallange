// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { TimeSeries } from "../types";
import { presence, sample, toTrack } from "./series.ts";

const ts = (columns: string[], rows: (number | null)[][]): TimeSeries => ({
  test_no: 1,
  signal: "droplet",
  columns,
  rows,
  n_total: rows.length,
  url: "",
  sources: [],
});

describe("toTrack", () => {
  test("null and too-short series give no track", () => {
    assert.equal(toTrack(null), null);
    assert.equal(toTrack(ts(["t_s", "d_mm"], [[0, 4]])), null);
  });
  test("sorts by time and fills gaps with the previous value", () => {
    const track = toTrack(ts(["t_s", "d_mm"], [[2, 2], [0, 4], [1, null]]))!;
    assert.deepEqual(Array.from(track.t), [0, 1, 2]);
    assert.deepEqual(Array.from(track.cols.d_mm), [4, 4, 2]);
    assert.equal(track.t0, 0);
    assert.equal(track.t1, 2);
  });
});

describe("sample", () => {
  const track = toTrack(ts(["t_s", "d_mm"], [[0, 4], [2, 2], [4, 1]]));
  test("interpolates linearly inside the range", () => {
    assert.equal(sample(track, "d_mm", 1), 3);
    assert.equal(sample(track, "d_mm", 3), 1.5);
  });
  test("outside the range: null, or the edge value when clamped", () => {
    assert.equal(sample(track, "d_mm", -1), null);
    assert.equal(sample(track, "d_mm", 9), null);
    assert.equal(sample(track, "d_mm", -1, true), 4);
    assert.equal(sample(track, "d_mm", 9, true), 1);
  });
  test("unknown column and missing track give null", () => {
    assert.equal(sample(track, "nope", 1), null);
    assert.equal(sample(null, "d_mm", 1), null);
  });
});

describe("presence", () => {
  const track = toTrack(ts(["t_s", "flame_d_mm"], [[0, 20], [10, 30]]));
  test("zero outside the data, one in the middle", () => {
    assert.equal(presence(track, -0.1), 0);
    assert.equal(presence(track, 10.1), 0);
    assert.equal(presence(track, 5), 1);
    assert.equal(presence(null, 5), 0);
  });
  test("fades in and out near the ends", () => {
    assert.ok(Math.abs(presence(track, 0.125, 0.25, 0.3) - 0.5) < 1e-9);
    assert.ok(Math.abs(presence(track, 9.85, 0.25, 0.3) - 0.5) < 1e-9);
  });
});
