// Faceted filtering and sorting of BASS-II tests. Pure functions; state lives in the URL.
// Self-contained (types only from "@/"), so node:test can run it.
import type { TestRow } from "../types";

export type FacetKey = "pi" | "material" | "flow" | "outcome" | "media";
export type Filters = Record<FacetKey, string[]>;
export type Option = { value: string; label: string };
export type Facet = { key: FacetKey; label: string; options: Option[]; values: (t: TestRow) => string[] };

export const FACETS: Facet[] = [
  {
    key: "pi",
    label: "Team (PI)",
    options: ["Olson", "Fernandez-Pello", "Bhattacharjee", "Miller", "T'ien", "Ferkul"].map((v) => ({ value: v, label: v })),
    values: (t) => [t.pi],
  },
  {
    key: "material",
    label: "Sample",
    options: [
      { value: "pmma_rod", label: "PMMA rod" },
      { value: "pmma_film", label: "PMMA film" },
      { value: "pmma_slab", label: "PMMA slab" },
      { value: "pmma_sphere", label: "PMMA sphere" },
      { value: "fabric", label: "SIBAL fabric" },
      { value: "nomex", label: "Nomex III" },
      { value: "candle", label: "Wax candle" },
    ],
    values: (t) => [t.material_class],
  },
  {
    key: "flow",
    label: "Flow geometry",
    options: [
      { value: "Opposed", label: "Opposed" },
      { value: "Concurrent", label: "Concurrent" },
      { value: "Stagnation", label: "Stagnation" },
      { value: "none", label: "Not in report log" },
    ],
    values: (t) => [t.flow_config ?? "none"],
  },
  {
    key: "outcome",
    label: "Outcome (derived)",
    options: [
      { value: "quench", label: "Quenched" },
      { value: "blowoff", label: "Blown off" },
      { value: "no_ignition", label: "No ignition" },
      { value: "flow_off", label: "Fan off" },
      { value: "burnout", label: "Burned out" },
      { value: "sustained", label: "Kept burning" },
      { value: "unknown", label: "Not stated" },
    ],
    values: (t) => [t.outcome ?? "unknown"],
  },
  {
    key: "media",
    label: "Media",
    options: [{ value: "video", label: "Local video" }],
    values: (t) => (t.has_video ? ["video"] : []),
  },
];

const KEYS = FACETS.map((f) => f.key);

export const emptyFilters = (): Filters => ({ pi: [], material: [], flow: [], outcome: [], media: [] });

export function fromParams(p: URLSearchParams): Filters {
  const f = emptyFilters();
  for (const k of KEYS) f[k] = p.getAll(k);
  return f;
}

export function toParams(f: Filters, base?: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  for (const k of KEYS) {
    p.delete(k);
    for (const v of f[k]) p.append(k, v);
  }
  return p;
}

export function toggle(f: Filters, key: FacetKey, value: string): Filters {
  const cur = f[key];
  return { ...f, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
}

const facetOf = (k: FacetKey) => FACETS.find((f) => f.key === k)!;

function matches(t: TestRow, f: Filters, skip?: FacetKey): boolean {
  return KEYS.every((k) => {
    if (k === skip || f[k].length === 0) return true;
    const vals = facetOf(k).values(t);
    return f[k].some((v) => vals.includes(v));
  });
}

export const applyFilters = (tests: TestRow[], f: Filters) => tests.filter((t) => matches(t, f));

/** Count per option, as if this facet were not filtered (standard faceted search). */
export function facetCounts(tests: TestRow[], f: Filters, key: FacetKey): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tests) {
    if (!matches(t, f, key)) continue;
    for (const v of facetOf(key).values(t)) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

export type SortKey = "test_id" | "pi" | "o2_initial_pct" | "o2_final_pct" | "co2_final_pct" | "co_final_ppm" | "test_date";

const idKey = (id: string): [string, number, string] => {
  const m = id.match(/^([A-Z])(\d+)(.*)$/);
  return m ? [m[1], Number(m[2]), m[3]] : [id, 0, ""];
};

export function sortTests(rows: TestRow[], key: SortKey, desc: boolean): TestRow[] {
  const dir = desc ? -1 : 1;
  const cmp = (a: TestRow, b: TestRow): number => {
    if (key === "test_id") {
      const [x, y] = [idKey(a.test_id), idKey(b.test_id)];
      return (x[0].localeCompare(y[0]) || x[1] - y[1] || x[2].localeCompare(y[2])) * dir;
    }
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1; // missing values always last
    if (vb == null) return -1;
    return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))) * dir;
  };
  return [...rows].sort(cmp);
}
