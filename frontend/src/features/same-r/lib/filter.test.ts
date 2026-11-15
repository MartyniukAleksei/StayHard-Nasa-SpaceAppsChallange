import assert from "node:assert/strict";
import { test } from "node:test";
import type { Row } from "../types";
import { facets, matches, NO_FILTERS, optionCount, toggle } from "./filter.ts";
import { groupTests } from "./tests.ts";

const groups = groupTests([
  { test_id: "73", test_no: 73, material: "Kapton", active_detectors: ["sts_v", "ion_b_v"], has_tem: true },
  { test_id: "73a", test_no: 73, material: "Kapton" },
  { test_id: "89", test_no: 89, material: "Teflon", active_detectors: ["ion_b_v"], has_tem: false },
  { test_id: "90", test_no: 90, material: "Pyrell", active_detectors: ["sts_v"], has_tem: false },
] as unknown as Row[]);
const all = facets(["Kapton", "Teflon", "Pyrell"]);
const ids = (f: typeof NO_FILTERS) => groups.filter((g) => matches(g, f, all)).map((g) => g.test_no);

test("no filters match everything", () => assert.deepEqual(ids(NO_FILTERS), [73, 89, 90]));

test("material and aging: any ticked option matches", () => {
  assert.deepEqual(ids({ ...NO_FILTERS, material: ["Teflon", "Pyrell"] }), [89, 90]);
  assert.deepEqual(ids({ ...NO_FILTERS, aging: ["aged"] }), [73]);
  assert.deepEqual(ids({ ...NO_FILTERS, aging: ["aged", "fresh"] }), [73, 89, 90]);
});

test("has: every ticked item must be present", () => {
  assert.deepEqual(ids({ ...NO_FILTERS, has: ["sts_v"] }), [73, 90]);
  assert.deepEqual(ids({ ...NO_FILTERS, has: ["sts_v", "tem"] }), [73]);
});

test("toggle and counts", () => {
  const f = toggle(NO_FILTERS, "material", "Kapton");
  assert.deepEqual(f.material, ["Kapton"]);
  assert.deepEqual(toggle(f, "material", "Kapton").material, []);
  const [material, , has] = all;
  assert.equal(optionCount(groups, f, all, material, "Teflon"), 1); // alone in its group
  assert.equal(optionCount(groups, { ...NO_FILTERS, has: ["sts_v"] }, all, has, "tem"), 1); // added to the AND group
});
