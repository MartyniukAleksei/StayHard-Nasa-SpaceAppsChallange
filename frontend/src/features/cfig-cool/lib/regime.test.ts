import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { RegimeTest } from "../types.ts";
import {
  VIEWS,
  allFilters,
  coolFlameProfile,
  coolKey,
  countBy,
  endKey,
  hardwareNotes,
  laneOf,
  longestBurn,
  matches,
  oxygenDrop,
  plotted,
  pressureLanes,
  sameConditionsWithoutCool,
  toggle,
} from "./regime.ts";

function t(over: Partial<RegimeTest>): RegimeTest {
  return {
    test_id: "x", flame_type: "normal", fuel: "butane", p_bar: 2.0266, x_o2: 0.39, x_o2_after: 0.38,
    fuel_flow_mg_s: 2, tad_k: 2000, zst: 0.1, hot_ignition: true, burn_time_s: 30, end_mode: "self_extinguished",
    peak_burner_t_c: 300, cool_flame: null, cool_flame_note: null, comment: null, has_telemetry: true, ...over,
  };
}

const ROWS: RegimeTest[] = [
  t({ test_id: "C3", cool_flame: true, cool_flame_note: "yes, PCI-D", x_o2: 0.395, burn_time_s: 35 }),
  t({ test_id: "C6", cool_flame: true, cool_flame_note: "yes, PCI-A", x_o2: 0.389, burn_time_s: 251, end_mode: "flow_terminated" }),
  t({ test_id: "C2", cool_flame: false, cool_flame_note: "no, PCI-hot", x_o2: 0.397 }),
  t({ test_id: "E1", fuel: "ethane", p_bar: 0.944, x_o2: 0.394, comment: "hit burner T limit" }),
  t({ test_id: "I1", flame_type: "inverse", fuel: "ethane", p_bar: 1.1, x_o2: 0.21, x_o2_after: null, end_mode: null, tad_k: null, peak_burner_t_c: null, comment: "FC=flow cut" }),
];

describe("keys and filters", () => {
  test("cool flame and ending keys keep 'not recorded' apart from 'no'", () => {
    assert.deepEqual(ROWS.map(coolKey), ["yes", "yes", "no", "unrecorded", "unrecorded"]);
    assert.deepEqual(ROWS.map(endKey), ["SE", "FT", "SE", "SE", "none"]);
  });

  test("everything matches the default filters; toggling a fuel off hides it", () => {
    const f = allFilters(ROWS);
    assert.equal(ROWS.filter((r) => matches(r, f)).length, 5);
    const noEthane = { ...f, fuels: toggle(f.fuels, "ethane") };
    assert.deepEqual(ROWS.filter((r) => matches(r, noEthane)).map((r) => r.test_id), ["C3", "C6", "C2"]);
    assert.ok(toggle(noEthane.fuels, "ethane").has("ethane"));
  });
});

describe("views", () => {
  test("tests without a value are counted, not plotted", () => {
    const tad = VIEWS.find((v) => v.id === "flow-tad")!;
    const r = plotted(ROWS, tad);
    assert.equal(r.points.length, 4);
    assert.equal(r.missing, 1);
  });

  test("pressure lanes are the distinct rounded pressures", () => {
    assert.deepEqual(pressureLanes(ROWS), [0.94, 1.1, 2.03]);
    assert.equal(laneOf(2.0266), 2.03);
  });
});

describe("checks computed from the table", () => {
  test("what the cool-flame tests have in common", () => {
    const p = coolFlameProfile(ROWS);
    assert.equal(p.n, 2);
    assert.deepEqual(p.fuels, ["butane"]);
    assert.deepEqual(p.flameTypes, ["normal"]);
    assert.deepEqual(p.xo2, [0.389, 0.395]);
    assert.deepEqual(p.zst, [0.1, 0.1]);
    assert.deepEqual(p.ids, ["C3", "C6"]);
  });

  test("contrast: normal runs of that fuel at that pressure without a cool flame", () => {
    assert.equal(sameConditionsWithoutCool(ROWS), 1);
  });

  test("oxygen drop and longest burn", () => {
    const d = oxygenDrop(ROWS)!;
    assert.equal(d.n, 4);
    assert.ok(Math.abs(d.maxDrop - 0.017) < 1e-9);
    assert.equal(d.maxId, "C2");
    assert.deepEqual(longestBurn(ROWS), { seconds: 251, id: "C6" });
    assert.equal(longestBurn([]), null);
  });

  test("hardware-limit comments are found by keyword (derived)", () => {
    assert.deepEqual(hardwareNotes(ROWS).map((r) => r.test_id), ["E1", "I1"]);
  });

  test("counts by ending", () => {
    assert.deepEqual(countBy(ROWS, endKey), { SE: 3, FT: 1, none: 1 });
  });
});
