// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DURATION, flameShape, frontX, ignite, replayFlameShape, step, type FlameGeometry, type FlameState, type StepInput } from "./flame.ts";

const geometry: FlameGeometry = {
  layout: {
    rodConcurrent: { tipX: -26, endX: 40 },
    rodOpposed: { startX: -42, endX: 26, radiusMm: 3.175 },
    flat: { halfLength: 47.5, width: 20, thickness: 1.2 },
    fabric: { halfLength: 50, width: 22, thickness: 0.8 },
    standoff: 2.2,
  },
  preQuenchHz: 1.1,
  aAtMinimum: 10.4,
  rodSoot: { fromA: 12, toA: 90 },
};
const burn: StepInput = { regime: "burning", ignitable: true, spreads: false, loop: true };
const run = (s: FlameState, seconds: number, input: StepInput) => {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) s = step(s, 0.05, input);
  return s;
};

describe("flame phases", () => {
  test("ignition leads to burning when the setting can burn", () => {
    assert.equal(run(ignite(), DURATION.igniting + 0.1, burn).phase, "burning");
  });
  test("no sustained flame below the ignition limit", () => {
    const s = run(ignite(), DURATION.igniting + 0.1, { ...burn, ignitable: false });
    assert.deepEqual([s.phase, s.reason], ["out", "no-ignition"]);
  });
  test("low flow quenches, high flow blows off", () => {
    const lit: FlameState = { phase: "burning", t: 0, progress: 0, reason: null };
    const q = run(lit, DURATION.quenching + 0.3, { ...burn, regime: "quench" });
    assert.deepEqual([q.phase, q.reason], ["out", "quench"]);
    const b = run(lit, DURATION.blowing + 0.3, { ...burn, regime: "blowoff" });
    assert.deepEqual([b.phase, b.reason], ["out", "blowoff"]);
  });
  test("restoring the flow in time restabilises the flame", () => {
    let s: FlameState = { phase: "burning", t: 0, progress: 0.3, reason: null };
    s = run(s, 1, { ...burn, regime: "blowoff" });
    assert.equal(s.phase, "blowing");
    s = step(s, 0.05, burn);
    assert.deepEqual([s.phase, s.progress], ["burning", 0.3]);
  });
  test("an extinguished flame stays out; only the end of the spreading loop restarts", () => {
    const out: FlameState = { phase: "out", t: 0, progress: 0, reason: "quench" };
    assert.equal(run(out, 10, burn).phase, "out");
    const spread = { ...burn, spreads: true };
    const end = run({ phase: "burning", t: 0, progress: 0, reason: null }, DURATION.spread + 0.2, spread);
    assert.deepEqual([end.phase, end.reason], ["out", "loop-end"]);
    assert.equal(run(end, DURATION.rest + 0.2, spread).phase, "igniting");
    assert.equal(run(end, DURATION.rest + 0.2, { ...spread, loop: false }).phase, "out");
  });
});

describe("flame shape (schematic)", () => {
  const rod = (flame: FlameState, a: number) =>
    flameShape({ config: "rod-concurrent", flame, a, rodRadiusMm: 3.18, look: null, geometry });

  test("nothing is drawn after extinction", () => {
    assert.equal(rod({ phase: "out", t: 0, progress: 0, reason: "quench" }, 20).visible, false);
  });
  test("the rod flame sits a standoff ahead of the tip and lengthens with the flow", () => {
    const lit: FlameState = { phase: "burning", t: 0, progress: 0, reason: null };
    const slow = rod(lit, 3);
    const fast = rod(lit, 80);
    assert.equal(slow.noseX, -26 - 2.2);
    assert.ok(fast.length > slow.length);
    assert.ok(slow.width > 2 * 3.18);
  });
  test("quenching ends as a hemisphere (L/W = 0.5) and fades", () => {
    const s = rod({ phase: "quenching", t: DURATION.quenching * 0.999, progress: 0, reason: null }, 3);
    assert.ok(Math.abs(s.length / s.width - 0.5) < 0.02, String(s.length / s.width));
    assert.ok(s.opacity < 0.05);
  });
  test("blowoff opens a hole at the nose", () => {
    const s = rod({ phase: "blowing", t: 1.2, progress: 0, reason: null }, 200);
    assert.ok(s.hole > 0.15 && s.visible);
    assert.equal(rod({ phase: "burning", t: 1.2, progress: 0, reason: null }, 200).hole, 0);
  });
  test("opposed flames travel upstream, the fabric flame downstream", () => {
    assert.ok(frontX("flat", 0.8, geometry.layout) < frontX("flat", 0.1, geometry.layout));
    assert.ok(frontX("rod-opposed", 0.8, geometry.layout) < frontX("rod-opposed", 0.1, geometry.layout));
    assert.ok(frontX("fabric", 0.8, geometry.layout) > frontX("fabric", 0.1, geometry.layout));
  });
  test("a spreading configuration without a look draws nothing", () => {
    const lit: FlameState = { phase: "burning", t: 0, progress: 0.2, reason: null };
    assert.equal(flameShape({ config: "fabric", flame: lit, a: 0, rodRadiusMm: 0, look: null, geometry }).visible, false);
  });
});

describe("replay flame (presence from the video, shape schematic)", () => {
  const look = { length: 17, height: 10, width: 25, closed: false, opacity: 1, soot: 0.55 };
  test("no presence, no flame", () => {
    assert.equal(replayFlameShape({ config: "flat", presence: 0, airCmS: 5, a: 0, rodRadiusMm: 6.35, look, geometry }).visible, false);
  });
  test("the rod cup shrinks to a hemisphere when the air display reads 0", () => {
    const burning = replayFlameShape({ config: "rod-concurrent", presence: 1, airCmS: 5, a: 23.6, rodRadiusMm: 6.35, look: null, geometry });
    const dying = replayFlameShape({ config: "rod-concurrent", presence: 0.4, airCmS: 0, a: 0, rodRadiusMm: 6.35, look: null, geometry });
    assert.ok(burning.length > dying.length);
    assert.ok(Math.abs(dying.length / dying.width - 0.5) < 1e-6);
    assert.equal(dying.opacity, 0.4);
    assert.ok(burning.soot > dying.soot);
  });
  test("a flat flame keeps its place and loses the yellow tail at low flow", () => {
    const fast = replayFlameShape({ config: "flat", presence: 1, airCmS: 10, a: 0, rodRadiusMm: 0, look, geometry });
    const slow = replayFlameShape({ config: "flat", presence: 1, airCmS: 0, a: 0, rodRadiusMm: 0, look, geometry });
    assert.equal(fast.noseX, slow.noseX);
    assert.ok(fast.soot > 0 && slow.soot === 0);
    assert.ok(fast.length > slow.length);
  });
});
