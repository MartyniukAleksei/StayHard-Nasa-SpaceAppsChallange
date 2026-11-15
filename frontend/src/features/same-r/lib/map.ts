import type { TestGroup } from "./tests.ts";

/** A numeric parameter of a test that the map can put on an axis. Values come from the API. */
export type Axis = { id: string; label: string; log?: boolean; get: (g: TestGroup) => number | null };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export const AXES: Axis[] = [
  { id: "heater", label: "Heater Rt/R0", get: (g) => num(g.main.heater_rt_r0) },
  { id: "peak", label: "Peak particles, /cm³", log: true, get: (g) => { const v = num(g.main.ptrak_peak_per_cc); return v != null && v > 0 ? v : null; } },
  { id: "aging", label: "Aging time of the aged row, s", get: (g) => num(g.aged?.net_aging_s) },
];

export const axis = (id: string) => AXES.find((a) => a.id === id) ?? AXES[0];

/**
 * Pushes overlapping marks apart sideways: each point keeps its y and moves left/right in steps of
 * `r` px until it no longer touches an earlier one. Positions are display only; values stay exact.
 */
export function dodge(points: { x: number; y: number }[], r: number): number[] {
  const placed: { x: number; y: number }[] = [];
  return points.map((p) => {
    for (let k = 0; ; k++) {
      const x = p.x + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * r;
      if (!placed.some((q) => Math.abs(q.x - x) < r && Math.abs(q.y - p.y) < r)) {
        placed.push({ x, y: p.y });
        return x;
      }
    }
  });
}
