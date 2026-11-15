// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { test } from "node:test";
import type { TimeSeries } from "@/features/same-r-3d";
import type { Row } from "../types";
import { column, fromRest, groupTests, heaterOff, materials, paramRows, peak } from "./tests.ts";

const row = (test_id: string, test_no: number, material: string) => ({ test_id, test_no, material }) as Row;

test("groupTests pairs N with Na and sorts by test number", () => {
  const g = groupTests([row("73a", 73, "Kapton"), row("51", 51, "Kapton"), row("73", 73, "Kapton")]);
  assert.deepEqual(g.map((x) => [x.test_no, x.main.test_id, x.aged?.test_id ?? null]), [
    [51, "51", null],
    [73, "73", "73a"],
  ]);
});

test("a duplicate test number is not taken for the aged row", () => {
  const [g] = groupTests([row("57", 57, "Lampwick"), row("57", 57, "Teflon")]);
  assert.equal(g.main.material, "Lampwick");
  assert.equal(g.aged, null);
});

test("materials counts tests, not table rows", () => {
  const g = groupTests([row("1", 1, "Teflon"), row("1a", 1, "Teflon"), row("2", 2, "Kapton"), row("3", 3, "Kapton")]);
  assert.deepEqual(materials(g), [["Kapton", 2], ["Teflon", 1]]);
});

test("column skips empty cells and heaterOff finds the first off second after 0", () => {
  const s = {
    columns: ["t_s", "heating", "dusttrak_a_mg_m3"],
    rows: [[-1, 0, null], [0, 1, 0.1], [1, 1, null], [2, 0, 0.3]],
  } as TimeSeries;
  assert.deepEqual(column(s, "dusttrak_a_mg_m3"), [[0, 0.1], [2, 0.3]]);
  assert.deepEqual(column(s, "nope"), []);
  assert.equal(heaterOff(s), 2);
});

test("paramRows shows the aged row only where it records a different value", () => {
  const main = { test_id: "65", material: "Silicone", description: "Baseline Aging", net_aging_s: 33, heating_s: 60 } as unknown as Row;
  const aged = { test_id: "65a", material: "Silicone", description: "aged", net_aging_s: 560, heating_s: null } as unknown as Row;
  const rows = Object.fromEntries(paramRows(main, aged).map((r) => [r.label, r]));
  assert.deepEqual(rows["Net aging time"], { label: "Net aging time", value: "33 s", aged: "560 s" });
  assert.equal(rows["Heating duration"].aged, null);
  assert.equal(rows["Material"].aged, null);
  assert.equal(rows["Description"].aged, null);
  assert.equal(rows["Primary aging time"].value, "not recorded");
});

test("fromRest subtracts the median before t = 0 and needs a baseline", () => {
  assert.deepEqual(fromRest([[-2, 1], [-1, 3], [0, 2], [5, -4]]), [[-2, -1], [-1, 1], [0, 0], [5, -6]]);
  assert.deepEqual(fromRest([[0, 1], [1, 2]]), []);
});

test("peak takes the largest |value| from t = 0 on", () => {
  assert.deepEqual(peak([[-1, -9], [0, 1], [3, -2], [4, 1.5]]), [3, -2]);
  assert.equal(peak([[-1, 5]]), null);
});
