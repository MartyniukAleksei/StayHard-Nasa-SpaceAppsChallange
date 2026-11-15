import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { decodeSqrt, encodeSqrt, gainFromStops, gainLabel, renderExposure } from "./exposure.ts";

const px = (...rgb: number[]) => new Uint8ClampedArray(rgb.flatMap((v) => [v, v, v, 255]));

describe("sqrt coding", () => {
  test("ends and midpoint", () => {
    assert.equal(decodeSqrt(0), 0);
    assert.equal(decodeSqrt(255), 1);
    assert.ok(Math.abs(decodeSqrt(128) - 0.252) < 0.001);
  });
  test("round trip keeps dim values to within one stored step", () => {
    for (const counts of [1, 5, 40, 400, 1500, 4095]) {
      const lin = counts / 4095;
      const back = decodeSqrt(encodeSqrt(lin)) * 4095;
      assert.ok(Math.abs(back - counts) <= Math.max(1.5, counts * 0.02), `${counts} -> ${back}`);
    }
  });
});

describe("gain", () => {
  test("labels", () => {
    assert.equal(gainLabel(0), "×1");
    assert.equal(gainLabel(4), "×16");
    assert.equal(gainLabel(-6), "×1/64");
    assert.equal(gainFromStops(-2), 0.25);
  });

  test("a gain of 1 shows the linear counts", () => {
    const dst = new Uint8ClampedArray(4);
    renderExposure(px(encodeSqrt(0.25)), dst, 1, 1, false);
    assert.ok(Math.abs(dst[0] - 64) <= 1);
    assert.equal(dst[3], 255);
  });

  test("a higher gain brightens a dim flame and clips at white", () => {
    const src = px(encodeSqrt(0.02));
    const a = new Uint8ClampedArray(4);
    const b = new Uint8ClampedArray(4);
    renderExposure(src, a, 1, 1, false);
    renderExposure(src, b, 1, 16, false);
    assert.ok(b[0] > a[0] * 10);
    const white = new Uint8ClampedArray(4);
    renderExposure(px(255), white, 1, 16, false);
    assert.equal(white[0], 255);
  });

  test("a short exposure dims saturated pixels, which are hatched when marked", () => {
    const src = px(255, 255, 255, 255, 255, 255); // 3x2 saturated
    const plain = new Uint8ClampedArray(src.length);
    const marked = new Uint8ClampedArray(src.length);
    renderExposure(src, plain, 3, 1 / 16, false);
    renderExposure(src, marked, 3, 1 / 16, true);
    assert.ok(plain[0] < 20, "dimmed to ~6% when not marked");
    const amber = [...marked].filter((_, i) => i % 4 === 0 && marked[i] === 217).length;
    assert.ok(amber > 0 && amber < 6, "hatch covers part of the saturated area");
  });
});
