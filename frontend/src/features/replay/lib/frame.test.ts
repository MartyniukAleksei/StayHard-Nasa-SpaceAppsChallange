// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Replay } from "../types";
import { duration, frameAt, interp, maxDiameter } from "./frame.ts";

const replay: Replay = {
  test_no: 35,
  fuel: "Heptane",
  end_type: "Extinction",
  burn_time_s: 8,
  d0_mm: 4,
  droplet: [
    [0, 4],
    [4, 3],
    [10, 2],
  ],
  flame: [
    [0, 0.05],
    [2, 20],
    [9, 10],
  ],
};

describe("interp", () => {
  test("linear inside the range", () => assert.equal(interp(replay.droplet, 2), 3.5));
  test("exact at the edges", () => {
    assert.equal(interp(replay.droplet, 0), 4);
    assert.equal(interp(replay.droplet, 10), 2);
  });
  test("null outside the range or for an empty series", () => {
    assert.equal(interp(replay.droplet, -0.1), null);
    assert.equal(interp(replay.droplet, 10.1), null);
    assert.equal(interp([], 1), null);
  });
});

describe("frameAt", () => {
  test("droplet and flame while burning", () => {
    const f = frameAt(replay, 2);
    assert.equal(f.dropletMm, 3.5);
    assert.equal(f.flameMm, 20);
  });
  test("no flame below the visibility threshold", () => assert.equal(frameAt(replay, 0).flameMm, null));
  test("flame out after burn_time_s, droplet still measured", () => {
    const f = frameAt(replay, 8.5);
    assert.equal(f.flameMm, null);
    assert.notEqual(f.dropletMm, null);
  });
  test("without burn_time_s the flame follows its series", () => {
    assert.notEqual(frameAt({ ...replay, burn_time_s: null }, 8.5).flameMm, null);
  });
});

describe("scene size", () => {
  test("duration is the latest of the series ends and burn time", () => {
    assert.equal(duration(replay), 10);
    assert.equal(duration({ ...replay, burn_time_s: 12 }), 12);
  });
  test("maxDiameter is the largest value, at least 1 mm", () => {
    assert.equal(maxDiameter(replay), 20);
    assert.equal(maxDiameter({ ...replay, droplet: [], flame: [] }), 1);
  });
});
