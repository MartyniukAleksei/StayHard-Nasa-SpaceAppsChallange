// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildReplay, flameOnAt, flameOutAt, sample, toTrack, visibility, zeroFlowAt, type VideoSeries } from "./replay.ts";

const series: VideoSeries = {
  psi_video_index: 0,
  start_gmt: "12:00:00",
  method: "test",
  columns: ["t_s", "air_cm_s", "fan_display", "rad_rel", "scene_px"],
  points: [
    [0, 5, 46, 0, 0],
    [1, 5, 46, 0.2, 500],
    [2, 4, 45, 0.3, 400],
    [3, null, null, null, null], // unreadable overlay
    [4, 2, 43, 0.4, 150],
    [5, 0, 41, 0.5, 90],
    ...Array.from({ length: 40 }, (_, i) => [6 + i, 0, 41, 0.3, 0] as (number | null)[]),
  ],
};

describe("tracks and sampling", () => {
  test("a column becomes parallel arrays without the missing rows", () => {
    const air = toTrack(series, "air_cm_s")!;
    assert.deepEqual([...air.t.slice(0, 5)], [0, 1, 2, 4, 5]);
    assert.deepEqual([...air.v.slice(0, 5)], [5, 5, 4, 2, 0]);
    assert.equal(toTrack(series, "nope"), null);
  });
  test("interpolates inside the record and is null outside it", () => {
    const air = toTrack(series, "air_cm_s")!;
    assert.equal(sample(air, 1), 5);
    assert.equal(sample(air, 1.5), 4.5);
    assert.equal(sample(air, 3), 3); // 2 → 4 across the one-second hole: still a small gap
    assert.equal(sample(air, -1), null);
    assert.equal(sample(air, 1000), null);
  });
  test("does not bridge a long gap", () => {
    const t = { t: Float64Array.from([0, 10]), v: Float64Array.from([1, 3]) };
    assert.equal(sample(t, 5), null);
    assert.equal(sample(t, 5, 20), 2);
  });
});

describe("events read from the record (estimates)", () => {
  test("zero flow is the first zero that holds", () => {
    assert.equal(zeroFlowAt(toTrack(series, "air_cm_s")!), 5);
    const never = { t: Float64Array.from([0, 1, 2]), v: Float64Array.from([3, 0, 2]) };
    assert.equal(zeroFlowAt(never), null);
  });
  test("flame on and out follow the bright-pixel level", () => {
    const scene = toTrack(series, "scene_px")!;
    assert.equal(flameOnAt(scene, 100), 1);
    assert.equal(flameOutAt(scene, 100), 4);
  });
  test("visibility is 0 below the level and grows on a log scale", () => {
    assert.equal(visibility(50, 100, 1000), 0);
    assert.equal(visibility(null, 100, 1000), 0);
    const low = visibility(150, 100, 1000);
    const high = visibility(1000, 100, 1000);
    assert.ok(low > 0.35 && low < high && high <= 1);
  });
});

describe("buildReplay", () => {
  test("needs the air and scene columns", () => {
    assert.equal(buildReplay(null, 100), null);
    assert.equal(buildReplay({ ...series, columns: ["t_s", "air_cm_s"], points: [[0, 1]] }, 100), null);
  });
  test("carries the range and the events", () => {
    const m = buildReplay(series, 100)!;
    assert.equal(m.tMin, 0);
    assert.equal(m.tMax, 45);
    assert.equal(m.sceneMax, 500);
    assert.equal(m.zeroFlowAt, 5);
    assert.equal(m.flameOnAt, 1);
    assert.equal(m.flameOutAt, 4);
    assert.ok(m.fan && m.rad);
  });
});
