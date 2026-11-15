import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { domain, heatGrid, level, logPos, maxAcross, points, riseFromZero, toPpm } from "./series.ts";

describe("saffire2 series helpers", () => {
  test("points drops gaps", () => {
    assert.deepEqual(points([0, 1, 2], [1, null, 3]), [[0, 1], [2, 3]]);
  });

  test("maxAcross takes the hottest value per sample", () => {
    assert.deepEqual(maxAcross([[1, null, 5], [2, 4, null]]), [2, 4, 5]);
  });

  test("riseFromZero subtracts the value at t = 0", () => {
    assert.deepEqual(riseFromZero([-2, -1, 0, 1], [1, 1, 2, 5]), [-1, -1, 0, 3]);
  });

  test("domain pads and handles empty input", () => {
    assert.deepEqual(domain([]), [0, 1]);
    const [lo, hi] = domain([10, 20], 0.1);
    assert.equal(lo, 9);
    assert.equal(hi, 21);
  });

  test("heatGrid bins by max and reports the range", () => {
    const { grid, lo, hi } = heatGrid([0, 1, 2, 3], [[1, 5, 2, 3]], 2);
    assert.deepEqual(grid, [[5, 3]]);
    assert.equal(lo, 1);
    assert.equal(hi, 5);
  });

  test("level quantises into steps", () => {
    assert.equal(level(0, 0, 10, 5), 0);
    assert.equal(level(10, 0, 10, 5), 4);
    assert.equal(level(5, 5, 5), 0);
  });

  test("toPpm converts percent", () => {
    assert.equal(toPpm(0.33), 3300);
    assert.equal(toPpm(null), null);
  });

  test("logPos is 0.5 at the geometric middle", () => {
    assert.equal(logPos(1, 0.01, 100), 0.5);
  });
});
