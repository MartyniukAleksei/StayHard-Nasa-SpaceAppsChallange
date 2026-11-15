import assert from "node:assert/strict";
import { test } from "node:test";
import { isGridOverview, particlesFirst } from "./tem.ts";

test("grid overviews are recognised, particle images are not", () => {
  for (const n of ["73 pre 26K_1 340 x.tif", "73 post 26K_1 340x.tif", "87 40P_1 195x.tif"]) assert.ok(isGridOverview(n), n);
  for (const n of ["87 40P_2 +1x-5y 1350x.tif", "73 pre 26K_13 a 7800.tif", "53 6S_3 -10x+1y 1350x.tif", "87 40P_10 +1x-5y 24.5k.tif", "L13 HR La.tif"])
    assert.ok(!isGridOverview(n), n);
});

test("particlesFirst moves the overview to the end", () => {
  assert.deepEqual(particlesFirst([{ name: "a 340x.tif" }, { name: "b 1350x.tif" }]).map((i) => i.name), ["b 1350x.tif", "a 340x.tif"]);
});
