// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Playback } from "./playback.ts";
import {
  buildTimeline,
  easeInOutCubic,
  holdSeconds,
  parseTour,
  readTour,
  tourKey,
  TourRunner,
  travelSeconds,
  type TourSpec,
  type TourStep,
} from "./tour.ts";

const step = (over: Partial<TourStep> = {}): TourStep => ({
  moment: "t",
  t: 3,
  action: "pause",
  speed: 1,
  camera: "droplet",
  focus: ["droplet"],
  show_frame: false,
  labels: [{ at: "droplet", text: "Flame out at 3.3 s; droplet still 2.51 mm", tags: ["data"], source: 0 }],
  ...over,
});
const spec = (steps: TourStep[]): TourSpec => ({ id: "tu_1-0", test_no: 155, steps, sources: [] });
const run = (r: TourRunner, p: Playback, seconds: number, dt = 1 / 60) => {
  for (let s = 0; s < seconds; s += dt) {
    p.tick(dt);
    r.update(dt);
  }
};

describe("parseTour / readTour", () => {
  test("accepts the backend event and rejects anything else", () => {
    const good = spec([step()]);
    assert.deepEqual(parseTour(JSON.stringify(good)), good);
    assert.equal(parseTour("not json"), null);
    assert.equal(parseTour(JSON.stringify({ ...good, steps: [] })), null);
    assert.equal(parseTour(JSON.stringify(spec([step({ camera: "top" as never })]))), null);
    assert.equal(parseTour(JSON.stringify(spec([step({ focus: ["chamber" as never] })]))), null);
  });
  test("reads the spec the agent feature stored, and survives blocked storage", () => {
    const good = spec([step()]);
    const storage = { getItem: (k: string) => (k === tourKey("tu_1-0") ? JSON.stringify(good) : null) };
    assert.deepEqual(readTour(storage, "tu_1-0"), good);
    assert.equal(readTour(storage, "other"), null);
    assert.equal(readTour(storage, null), null);
    const blocked = {
      getItem: () => {
        throw new Error("denied");
      },
    };
    assert.equal(readTour(blocked, "tu_1-0"), null);
  });
});

describe("timing", () => {
  test("a step is held for the reading time of its labels, 2.5 to 6 s", () => {
    assert.equal(holdSeconds(step({ labels: [] })), 2.5);
    assert.equal(holdSeconds(step({ labels: [{ at: "droplet", text: "x".repeat(200), tags: [], source: null }] })), 6);
    const h = holdSeconds(step());
    assert.ok(h > 2.5 && h < 6, String(h));
  });
  test("travel is longer for a longer stretch of data, 1.2 to 3 s", () => {
    assert.equal(travelSeconds(3, 3), 1.2);
    assert.ok(travelSeconds(3, 15) > travelSeconds(3, 4));
    assert.equal(travelSeconds(0, 400), 3);
  });
  test("easing starts and ends at rest", () => {
    assert.equal(easeInOutCubic(0), 0);
    assert.equal(easeInOutCubic(1), 1);
    assert.equal(easeInOutCubic(0.5), 0.5);
  });
  test("timeline: travel then hold for each step; a play step moves the next start", () => {
    const tl = buildTimeline(spec([step({ t: 1, action: "play", speed: 0.5 }), step({ t: 3 })]), 0);
    assert.deepEqual(
      tl.map((i) => i.step),
      [0, 1],
    );
    assert.equal(tl[0].travelS, travelSeconds(0, 1));
    assert.equal(tl[1].travelS, travelSeconds(1 + tl[0].holdS * 0.5, 3));
  });
});

describe("Playback.scrubTo / rampSpeed", () => {
  test("scrub reaches the target without jumping, forwards and backwards", () => {
    const p = new Playback(-2, 30, false, 0);
    p.scrubTo(15, 2);
    let prev = p.t;
    for (let i = 0; i < 121; i++) {
      p.tick(1 / 60);
      assert.ok(p.t >= prev && p.t - prev < 0.5, `step ${p.t - prev}`);
      prev = p.t;
    }
    assert.ok(Math.abs(p.t - 15) < 1e-9 && !p.scrubbing);
    p.scrubTo(3, 1);
    for (let i = 0; i < 62; i++) p.tick(1 / 60);
    assert.ok(Math.abs(p.t - 3) < 1e-9);
  });
  test("speed changes gradually", () => {
    const p = new Playback(0, 30, true, 0);
    p.rampSpeed(0.5);
    p.tick(0.1);
    assert.ok(p.speed < 1 && p.speed > 0.5);
    for (let i = 0; i < 10; i++) p.tick(0.1);
    assert.equal(p.speed, 0.5);
  });
  test("without loop the clock stops at the end of the data", () => {
    const p = new Playback(0, 1, true, 0.9);
    p.loop = false;
    p.tick(0.1);
    p.tick(0.1);
    assert.equal(p.t, 1);
    assert.equal(p.playing, false);
  });
});

describe("TourRunner", () => {
  const two = () => spec([step({ t: 3 }), step({ t: 15, action: "play", speed: 0.5, camera: "flame" })]);

  test("waits until begin, then travels, holds and finishes", () => {
    const p = new Playback(-2, 30, true, -2);
    const r = new TourRunner(two(), p);
    r.update(1);
    assert.equal(r.phase, "waiting");
    r.begin();
    assert.equal(r.phase, "travel");
    assert.equal(r.flight, 1);
    assert.equal(p.loop, false);
    assert.equal(r.labelsVisible, false);
    run(r, p, r.travelS + 0.1);
    assert.equal(r.phase, "hold");
    assert.ok(Math.abs(p.t - 3) < 1e-6 && !p.playing && r.labelsVisible);
    run(r, p, holdSeconds(r.step) + 0.1);
    assert.equal(r.index, 1);
    assert.equal(r.flight, 2);
    run(r, p, r.travelS + 0.1);
    assert.equal(r.phase, "hold");
    assert.ok(p.playing, "a play step lets time run");
    run(r, p, 1);
    assert.equal(p.speed, 0.5);
    assert.ok(p.t > 15);
    run(r, p, 6);
    assert.equal(r.phase, "done");
    assert.equal(p.playing, false);
  });
  test("pause freezes the tour and the clock; next and replay move between steps", () => {
    const p = new Playback(-2, 30, true, -2);
    const r = new TourRunner(two(), p);
    r.begin();
    run(r, p, r.travelS + 0.1);
    r.togglePause();
    run(r, p, 20);
    assert.equal(r.index, 0);
    assert.equal(r.phase, "hold");
    r.togglePause();
    r.next();
    r.togglePause(); // paused in the middle of a fast-forward: the clock stands still
    const frozenAt = p.t;
    run(r, p, 5);
    assert.equal(p.t, frozenAt);
    assert.equal(r.phase, "travel");
    r.togglePause();
    r.replay();
    r.next();
    assert.equal(r.index, 1);
    assert.equal(r.phase, "travel");
    assert.equal(p.frozen, false);
    r.next(); // already on the last step
    assert.equal(r.index, 1);
    r.replay();
    assert.equal(r.index, 0);
    assert.equal(r.phase, "travel");
    r.release();
    assert.ok(p.loop && p.playing && p.speed === 1);
  });
  test("reduced motion: no fast-forward, time never runs faster than real time", () => {
    const p = new Playback(-2, 30, true, -2);
    const r = new TourRunner(spec([step({ t: 15, action: "play", speed: 4 })]), p, true);
    r.begin();
    assert.equal(p.t, 15);
    run(r, p, 1.5);
    assert.equal(p.speed, 1);
  });
});
