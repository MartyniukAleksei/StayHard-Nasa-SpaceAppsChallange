import type { TimeSeries } from "@/features/same-r-3d";
import type { Row } from "../types";

/** One test: its table row and, if any, the `Na` row (the same smoke measured after aging). */
export type TestGroup = { test_no: number; main: Row; aged: Row | null };

export function groupTests(rows: Row[]): TestGroup[] {
  const by = new Map<number, Row[]>();
  for (const r of rows) by.set(r.test_no, [...(by.get(r.test_no) ?? []), r]);
  return [...by.entries()]
    .sort(([a], [b]) => a - b)
    .map(([test_no, rs]) => {
      const main = rs.find((r) => r.test_id === String(test_no)) ?? rs[0];
      return { test_no, main, aged: rs.find((r) => r.test_id === `${test_no}a`) ?? null };
    });
}

/** Tests per material, most frequent first. */
export function materials(groups: TestGroup[]): [string, number][] {
  const n = new Map<string, number>();
  for (const g of groups) {
    const m = g.main.material ?? "unknown";
    n.set(m, (n.get(m) ?? 0) + 1);
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** [t_s, value] pairs of one column; empty cells are skipped, not drawn as 0. */
export function column(s: TimeSeries, col: string): [number, number][] {
  const i = s.columns.indexOf(col);
  if (i < 0) return [];
  return s.rows.flatMap((r) => (r[0] != null && r[i] != null ? [[r[0], r[i]] as [number, number]] : []));
}

/** First second after t = 0 with the heater off; null if the heater stays on to the end. */
export function heaterOff(s: TimeSeries): number | null {
  for (const [t, h] of column(s, "heating")) if (t > 0 && h < 0.5) return t;
  return null;
}

/** Mark index of a material: its rank by test count, so the same material has the same mark on every page. */
export function markIndexer(groups: TestGroup[]): (m: string | null) => number {
  const order = materials(groups).map(([m]) => m);
  return (m) => Math.max(0, order.indexOf(m ?? "unknown")) % 8;
}

const PARAMS: [keyof Row, string, string][] = [
  ["material", "Material", ""],
  ["description", "Description", ""],
  ["date_2010", "Date, 2010", ""],
  ["inlet_velocity_cm_s", "Inlet velocity", " cm/s"],
  ["heater_rt_r0", "Heater resistance ratio Rt/R0", ""],
  ["heating_s", "Heating duration", " s"],
  ["primary_aging_s", "Primary aging time", " s"],
  ["primary_mixing_s", "Primary mixing time", " s"],
  ["net_aging_s", "Net aging time", " s"],
];

const show = (v: unknown, unit: string) => (v == null ? null : typeof v === "number" ? `${v}${unit}` : String(v));

/**
 * One parameter list for a test: values from its own row, plus the aged row's value where that row
 * records a different one (the aged row repeats the run, so most of its cells are empty or equal).
 */
export function paramRows(main: Row, aged: Row | null): { label: string; value: string; aged: string | null }[] {
  return PARAMS.map(([k, label, unit]) => {
    const a = k === "description" ? null : show(aged?.[k], unit); // the aged row's description just says "aged"
    const v = show(main[k], unit);
    return { label, value: v ?? "not recorded", aged: a != null && a !== v ? a : null };
  });
}
