import assert from "node:assert/strict";
import { test } from "node:test";
import type { Row } from "../types";
import { axis, dodge } from "./map.ts";
import { groupTests } from "./tests.ts";

test("dodge keeps far points and spreads overlapping ones by at least r", () => {
  const xs = dodge([{ x: 100, y: 50 }, { x: 100, y: 50 }, { x: 102, y: 51 }, { x: 300, y: 50 }], 10);
  assert.equal(xs[0], 100);
  assert.equal(xs[3], 300);
  const near = xs.slice(0, 3).sort((a, b) => a - b);
  assert.ok(near[1] - near[0] >= 10 && near[2] - near[1] >= 10);
});

test("axes read numbers only; text such as n/a and missing peaks are skipped", () => {
  const [g] = groupTests([
    { test_id: "5", test_no: 5, heater_rt_r0: "n/a", ptrak_peak_per_cc: 0 } as unknown as Row,
    { test_id: "5a", test_no: 5, net_aging_s: 560 } as unknown as Row,
  ]);
  assert.equal(axis("heater").get(g), null);
  assert.equal(axis("peak").get(g), null);
  assert.equal(axis("aging").get(g), 560);
  assert.equal(axis("nope").id, "heater");
});
