// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type { TestSummary } from "@/features/flex-tests";
import {
  applyFilters,
  endCounts,
  facetCounts,
  fromParams,
  o2Band,
  presetHref,
  pressureBand,
  toggle,
  toParams,
} from "./filter.ts";

const base: TestSummary = {
  test_no: 1,
  fuel: "Heptane",
  p_atm: 1.0,
  x_o2: 0.21,
  diluent: "N2",
  d0_mm: 3,
  dext_mm: 2,
  k_mm2_s: 0.5,
  burn_time_s: 8,
  end_type: "Extinction",
  fiber: false,
  has_series: true,
  has_video: false,
  cool_flame: false,
};
const mk = (o: Partial<TestSummary>): TestSummary => ({ ...base, ...o });

const queryOf = (href: string) => new URLSearchParams(href.split("?")[1] ?? "");

describe("bands", () => {
  test("pressure band edges match the preset SQL", () => {
    assert.equal(pressureBand(null), "unknown");
    assert.equal(pressureBand(0.7), "0.7");
    assert.equal(pressureBand(0.849), "0.7");
    assert.equal(pressureBand(0.85), "1");
    assert.equal(pressureBand(1.5), "1");
    assert.equal(pressureBand(2.0), "2-3");
  });

  test("O2 band: ISS air is 21% ± 0.6", () => {
    assert.equal(o2Band(null), "unknown");
    assert.equal(o2Band(0.21), "air");
    assert.equal(o2Band(0.2155), "air");
    assert.equal(o2Band(0.2165), "21.6-30");
    assert.equal(o2Band(0.3), "30+");
    assert.equal(o2Band(0.16), "<16.5");
    assert.equal(o2Band(0.18), "16.5-21");
  });
});

describe("URL state", () => {
  test("free-floating droplets only by default", () => {
    const f = fromParams(new URLSearchParams(""));
    assert.deepEqual(f.fiber, ["free"]);
    assert.equal(toParams(f).toString(), "");
  });

  test("fiber=all clears the fiber facet and round-trips", () => {
    const f = fromParams(new URLSearchParams("fiber=all&fuel=Heptane"));
    assert.deepEqual(f.fiber, []);
    const sp = toParams(f);
    assert.equal(sp.get("fiber"), "all");
    assert.equal(sp.get("fuel"), "Heptane");
  });

  test("toParams keeps unrelated params (e.g. selected test)", () => {
    const sp = toParams(fromParams(new URLSearchParams("o2=air")), new URLSearchParams("sel=35"));
    assert.equal(sp.get("sel"), "35");
    assert.equal(sp.get("o2"), "air");
  });

  test("toggle adds and removes a value without mutating", () => {
    const f = fromParams(new URLSearchParams(""));
    const on = toggle(f, "fuel", "Methanol");
    assert.deepEqual(on.fuel, ["Methanol"]);
    assert.deepEqual(f.fuel, []);
    assert.deepEqual(toggle(on, "fuel", "Methanol").fuel, []);
  });
});

describe("filtering", () => {
  const tests = [
    mk({ test_no: 1 }),
    mk({ test_no: 2, fiber: true }),
    mk({ test_no: 3, fiber: null }),
    mk({ test_no: 4, fuel: "Methanol", end_type: "Disruption" }),
    mk({ test_no: 5, has_series: false, cool_flame: true }),
  ];

  test("fiber tests are not mixed in by default", () => {
    const got = applyFilters(tests, fromParams(new URLSearchParams(""))).map((t) => t.test_no);
    assert.deepEqual(got, [1, 4, 5]);
  });

  test('"Has" facet requires all selected tags', () => {
    const f = fromParams(new URLSearchParams("tag=series,cool"));
    assert.deepEqual(applyFilters(tests, f), []);
    const g = fromParams(new URLSearchParams("tag=cool"));
    assert.deepEqual(applyFilters(tests, g).map((t) => t.test_no), [5]);
  });

  test("facet counts ignore the facet's own selection", () => {
    const f = fromParams(new URLSearchParams("fuel=Methanol"));
    const counts = facetCounts(tests, f, "fuel");
    assert.equal(counts.get("Heptane"), 2);
    assert.equal(counts.get("Methanol"), 1);
  });

  test("endCounts", () => {
    assert.deepEqual(endCounts(tests), { Extinction: 4, Disruption: 1, Completion: 0 });
  });
});

// Real data: the overview presets must open the explorer with the same counts (task 0001).
const CSV = new URL("../../../../../data/flex/tests.csv", import.meta.url);

function loadTests(): TestSummary[] {
  const [head, ...rows] = readFileSync(CSV, "utf8").trim().split(/\r?\n(?=\d+,)/);
  const cols = head.split(",");
  const at = (name: string) => cols.indexOf(name);
  const commentAt = at("ts_comment");
  const n = (v: string) => (v === "" ? null : Number(v));
  return rows.map((line: string) => {
    const cells = line.split(",");
    const v = (name: string) => cells[at(name)];
    const comment = cells.slice(commentAt).join(",");
    const fiber = v("ts_fiber");
    return {
      test_no: Number(v("test_no")),
      fuel: v("fuel"),
      p_atm: n(v("p_atm")),
      x_o2: n(v("x_o2")),
      diluent: v("diluent"),
      d0_mm: n(v("d0_mm")),
      dext_mm: n(v("dext_mm")),
      k_mm2_s: n(v("k_mm2_s")),
      burn_time_s: n(v("burn_time_s")),
      end_type: v("end_type") as TestSummary["end_type"],
      fiber: fiber === "Yes" ? true : fiber === "No" ? false : null,
      has_series: v("has_droplet_ts") === "True" && v("has_flame_uv_ts") === "True",
      has_video: false,
      cool_flame: /cool[- ]?flame/i.test(comment),
    };
  });
}

describe("presets on real data", { skip: !existsSync(CSV) && "data/flex/tests.csv not found" }, () => {
  const all = existsSync(CSV) ? loadTests() : [];
  const count = (groupId: string) => applyFilters(all, fromParams(queryOf(presetHref(groupId)))).length;

  test("all 274 tests parsed", () => assert.equal(all.length, 274));
  test('"ISS air" gives 21 free-floating tests', () => assert.equal(count("iss_air"), 21));
  test('"clean" d² tests give 161', () => assert.equal(count("clean_d2"), 161));
  test("lunar gives 13", () => assert.equal(count("lunar"), 13));
  test("cool flames give 40", () => assert.equal(count("cool_flames"), 40));
  test("CO₂ 99 · He 41", () => {
    assert.equal(count("co2"), 99);
    assert.equal(count("he"), 41);
  });
});
