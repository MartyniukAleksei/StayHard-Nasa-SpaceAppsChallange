// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { column, findGaps, fitWindow } from "./cardData.ts";

describe("column", () => {
  test("squares a column, drops missing values and sorts by time", () => {
    const s = { columns: ["t_s", "d_mm"], rows: [[2, 3], [1, 2], [3, null], [null, 5]] };
    assert.deepEqual(column(s, "d_mm", (v) => v * v), [[1, 4], [2, 9]]);
  });
  test("unknown column or no series gives nothing", () => {
    assert.deepEqual(column(null, "d_mm"), []);
    assert.deepEqual(column({ columns: ["t_s"], rows: [[1]] }, "d_mm"), []);
  });
});

describe("findGaps", () => {
  test("reports only spacings above the threshold, with their ends", () => {
    const pts: [number, number][] = [[0, 1], [0.1, 1], [1.4, 1], [1.5, 1]];
    assert.deepEqual(findGaps(pts, 0.5), [[0.1, 1.4]]);
  });
  test("a gap exactly at the threshold is not a gap", () => {
    assert.deepEqual(findGaps([[0, 0], [0.5, 0]], 0.5), []);
  });
});

describe("fitWindow", () => {
  const line: [number, number][] = [0, 1, 2, 3, 4, 5].map((x) => [x, 10 - 2 * x]);
  test("recovers slope and intercept inside the window only", () => {
    const f = fitWindow([...line, [6, 100]], 0, 5);
    assert.ok(f);
    assert.ok(Math.abs(f.slope + 2) < 1e-9 && Math.abs(f.intercept - 10) < 1e-9 && f.rms < 1e-9);
    assert.equal(f.n, 6);
  });
  test("too few points in the window gives null", () => {
    assert.equal(fitWindow(line, 0, 1), null);
  });
});
