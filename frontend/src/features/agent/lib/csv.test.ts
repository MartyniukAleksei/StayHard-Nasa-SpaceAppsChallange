import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chartCsv, csvName } from "./csv.ts";

const chart = {
  kind: "line" as const,
  title: "d² — FLEX-019, FLEX-027",
  x_label: "time, s",
  y_label: "d², mm²",
  derived: true,
  series: [{ id: "FLEX-019", label: "FLEX-019", points: [[0, 11.5], [0.5, 10.2]] as [number, number][], kind: "dots" as const, tone: "s1" as const }],
  test_nos: [19],
  notes: [],
};

describe("chartCsv", () => {
  test("header cites the DOI and marks derived data; labels with commas are quoted", () => {
    const csv = chartCsv(chart, "10.60555/mbq8-0451").split("\n");
    assert.equal(csv[0], "# d² — FLEX-019, FLEX-027. Data: NASA PSI FLEX (PSI-69), doi:10.60555/mbq8-0451. Derived from measured values");
    assert.equal(csv[1], 'series,"time, s","d², mm²"');
    assert.equal(csv[2], "FLEX-019,0,11.5");
    assert.equal(csvName(chart), "d_FLEX-019_FLEX-027.csv");
  });
});

describe("chartCsv for SAME-R", () => {
  test("header names SAME-R and its DOI", () => {
    const samer = { ...chart, title: "P-Trak — SAME-R #73", derived: false, test_nos: [], study: "samer", test_ids: [73] };
    assert.equal(chartCsv(samer, "10.60555/2np7-jv14").split("\n")[0], "# P-Trak — SAME-R #73. Data: NASA PSI SAME-R (PSI-101), doi:10.60555/2np7-jv14");
  });
});
