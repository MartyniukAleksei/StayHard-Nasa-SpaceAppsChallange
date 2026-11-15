import { test } from "node:test";
import assert from "node:assert/strict";
import { CELLS, N, brightness, offset } from "./draw.ts";

test("logo mask matches the favicon: 16 rows, cells inside the grid", () => {
  assert.equal(new Set(CELLS.map(([, y]) => y)).size, N);
  assert.ok(CELLS.every(([x, y]) => x >= 0 && x < N && y >= 0 && y < N));
  assert.equal(CELLS.length, 126);
});

test("brightness stays in 0..1", () => {
  for (const [x, y] of CELLS) for (let t = 0; t < 5; t += 0.37) {
    const b = brightness(x, y, t);
    assert.ok(b >= 0 && b <= 1);
  }
});

test("the base row stays put; movement stays within the spare cell", () => {
  for (let t = 0; t < 5; t += 0.37) {
    assert.deepEqual(offset(5, N - 1, t).map(Math.abs), [0, 0]);
    for (const [x, y] of CELLS) {
      const [dx, dy] = offset(x, y, t);
      assert.ok(Math.abs(dx) <= 0.75 && dy <= 0 && dy >= -1);
    }
  }
});
