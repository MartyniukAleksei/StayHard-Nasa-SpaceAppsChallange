// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { layoutDots, type DotIn } from "./layout.ts";

const R = 4;
const GAP = 1;
const D = 2 * R + GAP;

function minDistance(dots: { x: number; y: number }[]): number {
  let min = Infinity;
  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) {
      min = Math.min(min, Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y));
    }
  }
  return min;
}

describe("layoutDots", () => {
  test("a lone dot keeps its position", () => {
    assert.deepEqual(layoutDots([{ id: 1, x: 100, y: 50 }], { r: R, gap: GAP, half: 13 }), [{ id: 1, x: 100, y: 50 }]);
  });

  test("21 tests on the same pixel are spread apart without overlaps", () => {
    const dots: DotIn[] = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, x: 200, y: 50 }));
    const out = layoutDots(dots, { r: R, gap: GAP, half: 13 });
    assert.equal(out.length, 21);
    assert.ok(minDistance(out) >= D - 1e-6, `min distance ${minDistance(out)} < ${D}`);
  });

  test("dots stay inside their row band and the plot, close to their value", () => {
    const dots: DotIn[] = Array.from({ length: 30 }, (_, i) => ({ id: i, x: 296 + (i % 3), y: 40 }));
    const out = layoutDots(dots, { r: R, gap: GAP, half: 13, xMin: 50, xMax: 300 });
    for (const p of out) {
      assert.ok(Math.abs(p.y - 40) <= 13 - R + 1e-9);
      assert.ok(p.x <= 300 - R && p.x >= 50 + R, `x=${p.x} outside the plot`);
      assert.ok(Math.abs(p.x - 297) < 100, `x=${p.x} drifted too far`);
    }
    assert.ok(minDistance(out) >= D - 1e-6);
  });

  test("rows are independent and the result is deterministic", () => {
    const dots: DotIn[] = [
      { id: 1, x: 10, y: 20 },
      { id: 2, x: 10, y: 60 },
      { id: 3, x: 10, y: 20 },
    ];
    const a = layoutDots(dots, { r: R, gap: GAP, half: 13 });
    const b = layoutDots([...dots].reverse(), { r: R, gap: GAP, half: 13 });
    const key = (o: { id: number; x: number; y: number }[]) => JSON.stringify([...o].sort((p, q) => p.id - q.id));
    assert.equal(key(a), key(b));
    assert.equal(a.find((p) => p.id === 2)?.y, 60);
  });
});
