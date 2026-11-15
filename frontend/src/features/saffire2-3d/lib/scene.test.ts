import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ANCHOR_MM, burnAt, burnMode, frontRate, type BurnInput } from "./burn.ts";
import { alignedTIgn, buildAligned } from "./aligned.ts";
import { buildTimeline, ignitionPos, momentAt } from "./timeline.ts";

const sibal: BurnInput = { material: "SIBAL", burnTimeS: 145, ugBurnCm: 29, spreadLo: 2.1, spreadHi: 2.1, spreadNote: "" };
const pmma: BurnInput = { material: "PMMA", burnTimeS: 600, ugBurnCm: 10, spreadLo: 0.01, spreadHi: 0.04, spreadNote: "Note 4" };
const silicone: BurnInput = { material: "Silicone", burnTimeS: null, ugBurnCm: 0, spreadLo: null, spreadHi: null, spreadNote: "" };
const composite: BurnInput = { material: "PMMA & Nomex", burnTimeS: 140, ugBurnCm: 5, spreadLo: null, spreadHi: null, spreadNote: "" };

describe("burn state", () => {
  test("modes follow the table", () => {
    assert.equal(burnMode(sibal), "spread");
    assert.equal(burnMode(pmma), "anchored");
    assert.equal(burnMode(silicone), "none");
  });

  test("front uses the table rate, else length / time", () => {
    assert.equal(frontRate(sibal), 2.1);
    assert.equal(frontRate(composite), 50 / 140);
  });

  test("SIBAL front moves at 2.1 mm/s and stops at the burned length", () => {
    const s = burnAt(sibal, 100);
    assert.ok(s.flame);
    assert.equal(s.flameTo, 210);
    assert.equal(burnAt(sibal, 144).burned, 290);
    const after = burnAt(sibal, 146);
    assert.equal(after.flame, false);
    assert.equal(after.burned, 290);
  });

  test("anchored PMMA flame stays at the base, damage grows to the table length", () => {
    const s = burnAt(pmma, 300);
    assert.ok(s.flame);
    assert.equal(s.flameFrom, 0);
    assert.ok(s.flameTo <= ANCHOR_MM);
    assert.equal(s.burned, 50);
    assert.equal(burnAt(pmma, Infinity).burned, 100);
  });

  test("silicone never shows a flame; nothing before ignition", () => {
    assert.equal(burnAt(silicone, 30).flame, false);
    assert.equal(burnAt(silicone, Infinity).burned, 0);
    assert.equal(burnAt(sibal, -2).burned, 0);
    assert.equal(burnAt(sibal, null).burned, 0);
  });
});

describe("series timeline", () => {
  const recs = [
    { id: "2-1", epochStart: 0, epochEnd: 100_000, ignitionEpoch: 60_000 },
    { id: "2-2", epochStart: 130_000, epochEnd: 230_000, ignitionEpoch: 190_000 },
    { id: "2-3", epochStart: 3_230_000, epochEnd: 3_330_000, ignitionEpoch: 3_290_000 },
  ];
  const tl = buildTimeline(recs, 15);

  test("short pauses stay real, long ones are squeezed", () => {
    assert.equal(tl.gaps.length, 2);
    assert.equal(tl.gaps[0].p1 - tl.gaps[0].p0, 15); // 30 s real → 15 s
    assert.equal(tl.gaps[1].realS, 3000);
    assert.equal(tl.total, 100 + 15 + 100 + 15 + 100);
  });

  test("moment inside a recording gives epoch and time from ignition", () => {
    const m = momentAt(tl, 70);
    assert.equal(m.segment?.id, "2-1");
    assert.equal(m.epoch, 70_000);
    assert.equal(m.tIgn, 10);
  });

  test("moment in a pause has no recording", () => {
    const m = momentAt(tl, 107);
    assert.equal(m.segment, null);
    assert.equal(m.tIgn, null);
  });

  test("jump goes a few seconds before ignition", () => {
    assert.equal(ignitionPos(tl, "2-2"), 115 + 60 - 3);
  });
});

describe("side by side clock", () => {
  const recs = [
    { id: "2-1", epochStart: 0, epochEnd: 60_000, ignitionEpoch: 10_000 },
    { id: "2-5", epochStart: 600_000, epochEnd: 800_000, ignitionEpoch: 620_000 },
    { id: "2-9", epochStart: 900_000, epochEnd: 950_000, ignitionEpoch: null },
  ];
  const clock = buildAligned(recs);

  test("windows are relative to each sample's own ignition", () => {
    assert.deepEqual(clock.windows[0], { id: "2-1", from: -10, to: 50, ignited: true });
    assert.deepEqual(clock.windows[1], { id: "2-5", from: -20, to: 180, ignited: true });
    assert.equal(clock.tMin, -20);
    assert.equal(clock.tMax, 180);
  });

  test("a recording without ignition starts at 0", () => {
    assert.deepEqual(clock.windows[2], { id: "2-9", from: 0, to: 50, ignited: false });
  });

  test("all samples share t inside their windows; final state after, nothing before", () => {
    assert.equal(alignedTIgn(clock, "2-1", 30), 30);
    assert.equal(alignedTIgn(clock, "2-5", 30), 30);
    assert.equal(alignedTIgn(clock, "2-1", 100), Infinity);
    assert.equal(alignedTIgn(clock, "2-1", -15), null);
    assert.equal(alignedTIgn(clock, "2-5", -15), -15);
    assert.equal(alignedTIgn(clock, "2-7", 0), null);
  });
});
