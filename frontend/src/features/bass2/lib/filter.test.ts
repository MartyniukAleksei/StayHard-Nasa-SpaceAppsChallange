import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { TestRow } from "../types";
import { applyFilters, emptyFilters, facetCounts, fromParams, sortTests, toggle, toParams } from "./filter.ts";

const row = (o: Partial<TestRow>): TestRow =>
  ({
    test_id: "O1", pi: "Olson", test_date: "2014-07-21", gmt_day: 202, material: "rod", material_class: "pmma_rod",
    thickness_mm: null, diameter_mm: 12.7, flow_restrictor: 2, o2_initial_pct: 15, o2_final_pct: 14,
    o2_final_suspect: false, co2_initial_pct: null, co2_final_pct: null, co_initial_ppm: null, co_final_ppm: null,
    co_over_range: false, flow_config: "Concurrent", outcome: "quench", outcome_confidence: "high",
    has_video: false, in_report_log: true, ...o,
  }) as TestRow;

const T = [
  row({ test_id: "O13a", o2_initial_pct: 15.9 }),
  row({ test_id: "O2", outcome: "unknown", o2_initial_pct: 22.2, has_video: true }),
  row({ test_id: "B3", pi: "Bhattacharjee", material_class: "pmma_film", flow_config: "Opposed", o2_initial_pct: null }),
  row({ test_id: "O21", flow_config: null, outcome: null, in_report_log: false }),
];

describe("filters", () => {
  test("URL round trip keeps repeated values", () => {
    const f = toggle(toggle(emptyFilters(), "pi", "Olson"), "outcome", "quench");
    assert.deepEqual(fromParams(toParams(f)), f);
  });
  test("any-of within a facet, and-across facets; null flow/outcome map to none/unknown", () => {
    assert.deepEqual(applyFilters(T, { ...emptyFilters(), pi: ["Olson"], outcome: ["quench"] }).map((t) => t.test_id), ["O13a"]);
    assert.deepEqual(applyFilters(T, { ...emptyFilters(), flow: ["none"] }).map((t) => t.test_id), ["O21"]);
    assert.deepEqual(applyFilters(T, { ...emptyFilters(), outcome: ["unknown"] }).map((t) => t.test_id), ["O2", "O21"]);
    assert.deepEqual(applyFilters(T, { ...emptyFilters(), media: ["video"] }).map((t) => t.test_id), ["O2"]);
  });
  test("facet counts ignore their own facet", () => {
    const f = { ...emptyFilters(), pi: ["Olson"] };
    assert.equal(facetCounts(T, f, "pi").get("Bhattacharjee"), 1);
    assert.equal(facetCounts(T, f, "material").get("pmma_film"), undefined);
  });
});

describe("sortTests", () => {
  test("test ids sort naturally, numbers numerically, missing last", () => {
    assert.deepEqual(sortTests(T, "test_id", false).map((t) => t.test_id), ["B3", "O2", "O13a", "O21"]);
    assert.deepEqual(sortTests(T, "o2_initial_pct", true).map((t) => t.test_id), ["O2", "O13a", "O21", "B3"]);
  });
});
