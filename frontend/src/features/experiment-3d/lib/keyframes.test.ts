// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { frameTimes, keyframeStep, nearestKeyframe, pickKeyframes, prioritize } from "./keyframes.ts";

describe("prioritize", () => {
  const kfs = [0, 1, 2, 3, 4].map((t) => ({ i: t, t }));
  test("frames of the tour moments load first, the rest keep their order", () => {
    assert.deepEqual(
      prioritize(kfs, [3.1, 0.9, 3.2]).map((k) => k.t),
      [3, 1, 0, 2, 4],
    );
  });
  test("no moments: the order is unchanged", () => {
    assert.deepEqual(prioritize(kfs, []), kfs);
  });
});

describe("frameTimes", () => {
  test("frame time is start + offset − ignition, in seconds", () => {
    const ignition = Date.parse("2010-06-29T08:30:48.187Z");
    const times = frameTimes("2010-06-29T08:30:39.941852", [0, 8246, null], ignition);
    assert.ok(Math.abs(times[0] - -8.246) < 1e-9);
    assert.ok(Math.abs(times[1]) < 1e-9);
    assert.ok(Number.isNaN(times[2]));
  });
});

describe("keyframeStep", () => {
  test("short tests keep the minimum step, long tests get a sparser one", () => {
    assert.equal(keyframeStep(-2, 8, 0.25, 48), 0.25);
    assert.equal(keyframeStep(0, 48, 0.25, 48), 1);
  });
});

describe("pickKeyframes", () => {
  const times = Array.from({ length: 101 }, (_, i) => i / 10); // 0, 0.1 … 10 s
  test("one frame per mark, nearest in time, no duplicates", () => {
    const kf = pickKeyframes(times, 0, 2, 0.5);
    assert.deepEqual(kf.map((k) => k.i), [0, 5, 10, 15, 20]);
  });
  test("marks with no frame within one step are skipped", () => {
    const kf = pickKeyframes(times, -3, 1, 1);
    assert.deepEqual(kf.map((k) => k.i), [0, 10]); // marks −3 and −2 are too far from the first frame
  });
});

describe("nearestKeyframe", () => {
  test("closest loaded keyframe, null when nothing is loaded", () => {
    const loaded = [{ i: 0, t: 0 }, { i: 10, t: 1 }];
    assert.equal(nearestKeyframe(loaded, 0.7)?.i, 10);
    assert.equal(nearestKeyframe([], 0.7), null);
  });
});
