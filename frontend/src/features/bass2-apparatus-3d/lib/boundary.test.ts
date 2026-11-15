// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  A_AT_MINIMUM,
  boundaryO2,
  canIgnite,
  flowForStretch,
  flowLabel,
  flowToSlider,
  rodRegime,
  sliderToFlow,
  stretchRate,
} from "./boundary.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

describe("Eq. 6.1 boundary (report p.75)", () => {
  test("matches the formula at hand-computed points", () => {
    near(boundaryO2(0), 19.4);
    near(boundaryO2(10), 6 * Math.exp(-5) + 0.167 + 13.4);
    near(boundaryO2(100), 15.07, 1e-9 + 1e-3);
  });

  test("minimum sits inside the report's 8 to 12 1/s, near 13.5 to 13.6 % O2", () => {
    assert.ok(A_AT_MINIMUM > 8 && A_AT_MINIMUM < 12);
    const min = boundaryO2(A_AT_MINIMUM);
    assert.ok(min > 13.5 && min < 13.65, String(min));
    assert.ok(boundaryO2(A_AT_MINIMUM - 0.5) > min && boundaryO2(A_AT_MINIMUM + 0.5) > min);
  });

  test("stretch rate: a = 1.5 U / r for the base rod, corrected by sqrt(r/r0) for larger rods", () => {
    near(stretchRate(5, 0.318), (1.5 * 5) / 0.318);
    near(stretchRate(5, 0.635), (1.5 * 5) / 0.635 * Math.sqrt(0.635 / 0.318));
    near(flowForStretch(stretchRate(7.3, 0.476), 0.476), 7.3);
  });
});

describe("rod regime", () => {
  test("typical ignition setting burns", () => {
    assert.equal(rodRegime(5, 0.318, 17), "burning");
  });
  test("very low flow is the quenching branch", () => {
    assert.equal(rodRegime(0.3, 0.318, 15), "quench");
    // the fit tops out at 19.4 % O2 for a = 0: in 21 % O2 it predicts no quenching at any flow
    assert.equal(rodRegime(0.01, 0.318, 21), "burning");
  });
  test("the duct's maximum flow blows a 15 % O2 flame off, but not a 21 % one", () => {
    assert.equal(rodRegime(55, 0.318, 15), "blowoff");
    assert.equal(rodRegime(55, 0.318, 21), "burning");
  });
  test("below the minimum of the curve nothing burns at any flow", () => {
    for (const u of [0.3, 1, 2.2, 5, 20, 55]) assert.notEqual(rodRegime(u, 0.318, 13.4), "burning");
  });
  test("a flame at the minimum survives 13.7 % O2", () => {
    assert.equal(rodRegime(flowForStretch(A_AT_MINIMUM, 0.318), 0.318, 13.7), "burning");
  });
});

describe("labels and slider", () => {
  test("no number below the calibrated range", () => {
    assert.equal(flowLabel(1.4, 2), "< ~2 cm/s (below calibrated range)");
    assert.equal(flowLabel(2, 2), "2.0 cm/s");
    assert.equal(flowLabel(34.6, 2), "35 cm/s");
  });
  test("ignition limit", () => {
    assert.equal(canIgnite(14.4, 14.5), false);
    assert.equal(canIgnite(14.5, 14.5), true);
  });
  test("slider maps the ends and round-trips", () => {
    near(sliderToFlow(0, 0.1, 55), 0.1);
    near(sliderToFlow(1, 0.3, 55), 55);
    near(flowToSlider(sliderToFlow(0.37, 0.3, 55), 0.3, 55), 0.37);
    near(sliderToFlow(-1, 0.3, 55), 0.3);
  });
});
