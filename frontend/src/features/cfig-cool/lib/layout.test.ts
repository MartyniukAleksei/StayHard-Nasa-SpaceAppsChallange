import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { layoutDots } from "./layout.ts";

const opts = { r: 3, gap: 1, maxDy: 14, maxDx: 24 };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("layoutDots", () => {
  test("separate dots stay exactly where they are", () => {
    const out = layoutDots([{ id: "a", x: 10, y: 10 }, { id: "b", x: 80, y: 10 }], opts);
    assert.deepEqual(out.map((d) => [d.x, d.y, d.nudged]), [[10, 10, false], [80, 10, false]]);
  });

  test("stacked dots are spread without touching, the first keeps its true spot", () => {
    const dots = Array.from({ length: 9 }, (_, i) => ({ id: String(i), x: 50, y: 20 }));
    const out = layoutDots(dots, opts);
    assert.equal(out[0].nudged, false);
    assert.deepEqual([out[0].x, out[0].y], [50, 20]);
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) assert.ok(dist(out[i], out[j]) >= 2 * 3, `${i}-${j}`);
    }
  });

  test("prefers moving along the lane's free axis before sideways", () => {
    const out = layoutDots([{ id: "a", x: 50, y: 20 }, { id: "b", x: 50, y: 20 }], opts);
    assert.equal(out[1].x, 50);
    assert.notEqual(out[1].y, 20);
  });

  test("never drops a dot when there is no room", () => {
    const dots = Array.from({ length: 200 }, (_, i) => ({ id: String(i), x: 5, y: 5 }));
    assert.equal(layoutDots(dots, { ...opts, maxDy: 4, maxDx: 4 }).length, 200);
  });
});
