// Pure logic for the PSI-159 regime map: views, filters, and the checks shown next to the papers'
// claims. Everything is computed from the rows the API returns; nothing is typed in here.
import type { RegimeTest } from "../types.ts";

export type CoolKey = "yes" | "no" | "unrecorded";
export type EndKey = "SE" | "FT" | "none";
export type NumKey = "p_bar" | "x_o2" | "fuel_flow_mg_s" | "tad_k" | "peak_burner_t_c";

export const coolKey = (t: RegimeTest): CoolKey =>
  t.cool_flame === true ? "yes" : t.cool_flame === false ? "no" : "unrecorded";

export const endKey = (t: RegimeTest): EndKey =>
  t.end_mode === "self_extinguished" ? "SE" : t.end_mode === "flow_terminated" ? "FT" : "none";

export const FUEL_LABEL: Record<string, string> = { ethane: "ethane", propane: "propane", butane: "n-butane" };
export const fuelLabel = (f: string) => FUEL_LABEL[f] ?? f;

// ---- views ---------------------------------------------------------------------------------

export interface Axis {
  key: NumKey;
  label: string;
  unit: string;
  /** display = value * mult (mole fraction -> percent) */
  mult: number;
  digits: number;
}

const AX: Record<NumKey, Axis> = {
  p_bar: { key: "p_bar", label: "approx. pressure", unit: "bar", mult: 1, digits: 2 },
  x_o2: { key: "x_o2", label: "XO₂ before test", unit: "%", mult: 100, digits: 1 },
  fuel_flow_mg_s: { key: "fuel_flow_mg_s", label: "hydrocarbon flow", unit: "mg/s", mult: 1, digits: 2 },
  tad_k: { key: "tad_k", label: "adiabatic flame temperature Tad", unit: "K", mult: 1, digits: 0 },
  peak_burner_t_c: { key: "peak_burner_t_c", label: "peak burner temperature", unit: "°C", mult: 1, digits: 0 },
};

export type ViewId = "p-o2" | "flow-tad" | "flow-burner";
export interface View {
  id: ViewId;
  label: string;
  x: Axis;
  y: Axis;
  /** y is a handful of fixed pressures: draw lanes instead of a continuous axis */
  lanes: boolean;
}

export const VIEWS: View[] = [
  { id: "p-o2", label: "Pressure × O₂", x: AX.x_o2, y: AX.p_bar, lanes: true },
  { id: "flow-tad", label: "Fuel flow × Tad", x: AX.fuel_flow_mg_s, y: AX.tad_k, lanes: false },
  { id: "flow-burner", label: "Fuel flow × burner T", x: AX.fuel_flow_mg_s, y: AX.peak_burner_t_c, lanes: false },
];

export const display = (axis: Axis, v: number) => (v * axis.mult).toFixed(axis.digits);

/** Tests that have both values for the view, and how many have not (not plotted, not guessed). */
export function plotted(tests: RegimeTest[], view: View): { points: RegimeTest[]; missing: number } {
  const points = tests.filter((t) => t[view.x.key] != null && t[view.y.key] != null);
  return { points, missing: tests.length - points.length };
}

export function extent(tests: RegimeTest[], key: NumKey): [number, number] {
  const v = tests.map((t) => t[key]).filter((x): x is number => x != null);
  return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1];
}

export const laneOf = (p: number) => Math.round(p * 100) / 100;

export function pressureLanes(tests: RegimeTest[]): number[] {
  return [...new Set(tests.filter((t) => t.p_bar != null).map((t) => laneOf(t.p_bar as number)))].sort(
    (a, b) => a - b,
  );
}

// ---- filters -------------------------------------------------------------------------------

export interface Filters {
  fuels: ReadonlySet<string>;
  flames: ReadonlySet<string>;
  cool: ReadonlySet<CoolKey>;
  ends: ReadonlySet<EndKey>;
}

export const allFilters = (tests: RegimeTest[]): Filters => ({
  fuels: new Set(tests.map((t) => t.fuel)),
  flames: new Set(tests.map((t) => t.flame_type)),
  cool: new Set<CoolKey>(["yes", "no", "unrecorded"]),
  ends: new Set<EndKey>(["SE", "FT", "none"]),
});

export function toggle<T>(set: ReadonlySet<T>, v: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(v)) next.add(v);
  return next;
}

export const matches = (t: RegimeTest, f: Filters): boolean =>
  f.fuels.has(t.fuel) && f.flames.has(t.flame_type) && f.cool.has(coolKey(t)) && f.ends.has(endKey(t));

// ---- checks computed from the table ---------------------------------------------------------

const range = (v: number[]): [number, number] | null => (v.length ? [Math.min(...v), Math.max(...v)] : null);
const nonNull = (v: (number | null)[]) => v.filter((x): x is number => x != null);
const nums = (tests: RegimeTest[], key: NumKey) => tests.map((t) => t[key]).filter((x): x is number => x != null);

/** What the tests that carry a cool-flame "yes" have in common. Derived from the table column. */
export function coolFlameProfile(tests: RegimeTest[]) {
  const cool = tests.filter((t) => t.cool_flame === true);
  return {
    n: cool.length,
    fuels: [...new Set(cool.map((t) => t.fuel))].sort(),
    flameTypes: [...new Set(cool.map((t) => t.flame_type))].sort(),
    pressure: range(nums(cool, "p_bar")),
    xo2: range(nums(cool, "x_o2")),
    zst: range(nonNull(cool.map((t) => t.zst))),
    ids: cool.map((t) => t.test_id).sort(),
  };
}

/** Normal-flame tests of the same fuel at the cool-flame pressure with no cool flame noted: the contrast. */
export function sameConditionsWithoutCool(tests: RegimeTest[]): number {
  const p = coolFlameProfile(tests).pressure;
  const fuels = new Set(coolFlameProfile(tests).fuels);
  if (!p) return 0;
  return tests.filter(
    (t) =>
      t.cool_flame !== true &&
      t.flame_type === "normal" &&
      fuels.has(t.fuel) &&
      t.p_bar != null &&
      t.p_bar >= p[0] - 0.01 &&
      t.p_bar <= p[1] + 0.01,
  ).length;
}

/** Oxygen lost from the closed chamber during a test, from "XO2 before" and "XO2 after". */
export function oxygenDrop(tests: RegimeTest[]) {
  const d = tests
    .filter((t) => t.x_o2 != null && t.x_o2_after != null)
    .map((t) => ({ id: t.test_id, drop: (t.x_o2 as number) - (t.x_o2_after as number) }));
  if (!d.length) return null;
  const max = d.reduce((a, b) => (b.drop > a.drop ? b : a));
  return { n: d.length, maxDrop: max.drop, maxId: max.id };
}

export function longestBurn(tests: RegimeTest[]) {
  const withTime = tests.filter((t) => t.burn_time_s != null);
  if (!withTime.length) return null;
  const t = withTime.reduce((a, b) => ((b.burn_time_s as number) > (a.burn_time_s as number) ? b : a));
  return { seconds: t.burn_time_s as number, id: t.test_id };
}

/** Tests whose comment says the run was cut short by a hardware limit or by hand (derived: keyword match). */
export const HARDWARE_RE = /(burner|temperature)\s*(t\b|temp\w*)?\s*limit|flow cut|\bFC\b|manually stopped/i;
export const hardwareNotes = (tests: RegimeTest[]) => tests.filter((t) => t.comment && HARDWARE_RE.test(t.comment));

/** Highest temperature in the table next to a limit quoted by a paper (K). */
export function peakBurnerKelvin(tests: RegimeTest[]): number | null {
  const v = nums(tests, "peak_burner_t_c");
  return v.length ? Math.max(...v) + 273.15 : null;
}

export function countBy<T extends string>(tests: RegimeTest[], pick: (t: RegimeTest) => T): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const t of tests) out[pick(t)] = (out[pick(t)] ?? 0) + 1;
  return out;
}
