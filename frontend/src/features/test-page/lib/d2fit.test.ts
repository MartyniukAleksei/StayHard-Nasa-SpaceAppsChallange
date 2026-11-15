// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { findGaps, fitD2, fitLine, linearFit, type Pt } from "./d2fit.ts";

const K = 0.5;
const D0SQ = 16;
/** d² data: heat-up bump for the first 1 s, then a clean line with slope −K. */
function synthetic(step = 0.1, tEnd = 20): Pt[] {
  const pts: Pt[] = [];
  for (let t = 0; t <= tEnd + 1e-9; t += step) {
    const heat = t < 1 ? 0.8 * Math.sin(Math.PI * t) : 0;
    pts.push([Number(t.toFixed(3)), D0SQ - K * t + heat]);
  }
  return pts;
}

describe("linearFit", () => {
  test("recovers an exact line", () => {
    const fit = linearFit([[0, 1], [1, 3], [2, 5]])!;
    assert.ok(Math.abs(fit.b - 2) < 1e-12 && Math.abs(fit.a - 1) < 1e-12);
    assert.equal(fit.r2, 1);
  });
  test("null for fewer than two points or a vertical set", () => {
    assert.equal(linearFit([[1, 1]]), null);
    assert.equal(linearFit([[1, 1], [1, 2]]), null);
  });
});

describe("fitD2", () => {
  test("skips the heat-up and recovers K", () => {
    const fit = fitD2(synthetic(), null)!;
    assert.ok(Math.abs(fit.k - K) < 0.02, `k=${fit.k}`);
    assert.ok(fit.r2 > 0.99, `r2=${fit.r2}`);
    assert.ok(fit.t0 > 0.3 && fit.t0 < 1.0, `window starts at the heat-up peak, t0=${fit.t0}`);
  });
  test("stops at flame-out", () => {
    const fit = fitD2(synthetic(), 12)!;
    assert.ok(fit.t1 <= 12);
  });
  test("null when there is not enough data or d² does not fall", () => {
    assert.equal(fitD2(synthetic().slice(0, 3), null), null);
    assert.equal(fitD2([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]], null), null);
  });
  test("fit line spans the window", () => {
    const fit = fitD2(synthetic(), null)!;
    const [a, b] = fitLine(fit);
    assert.equal(a[0], fit.t0);
    assert.equal(b[0], fit.t1);
    assert.ok(b[1] < a[1]);
  });
});

describe("findGaps", () => {
  test("finds a hole in regular sampling", () => {
    const times = [...Array.from({ length: 48 }, (_, i) => i * 0.1), ...Array.from({ length: 20 }, (_, i) => 6 + i * 0.1)];
    const gaps = findGaps(times);
    assert.equal(gaps.length, 1);
    assert.ok(Math.abs(gaps[0][0] - 4.7) < 1e-9 && Math.abs(gaps[0][1] - 6) < 1e-9);
  });
  test("no gaps in regular data", () => {
    assert.deepEqual(findGaps(Array.from({ length: 50 }, (_, i) => i * 0.03)), []);
  });
});
