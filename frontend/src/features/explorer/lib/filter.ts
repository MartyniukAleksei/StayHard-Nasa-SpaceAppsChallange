// Faceted filtering of FLEX tests. Pure functions; state lives in the URL.
// Band edges mirror the SQL of the overview presets (backend studies/flex/repository.py),
// so a preset link opens the explorer with exactly the same counts.
import type { TestSummary } from "@/features/flex-tests";

export type FacetKey = "fuel" | "diluent" | "pressure" | "o2" | "fiber" | "end" | "tag";
export type Filters = Record<FacetKey, string[]>;
export type Option = { value: string; label: string };
export type Facet = {
  key: FacetKey;
  label: string;
  options: Option[];
  values: (t: TestSummary) => string[];
  /** "any": a test matches if it has one of the selected values; "all": all of them */
  mode: "any" | "all";
};

const AIR_O2 = 0.21;
const AIR_TOL = 0.006;

export function pressureBand(p: number | null): string {
  if (p == null) return "unknown";
  if (p < 0.85) return "0.7";
  if (p <= 1.5) return "1";
  return "2-3";
}

export function o2Band(x: number | null): string {
  if (x == null) return "unknown";
  if (Math.abs(x - AIR_O2) < AIR_TOL) return "air";
  if (x >= 0.3) return "30+";
  if (x < 0.165) return "<16.5";
  if (x < AIR_O2) return "16.5-21";
  return "21.6-30";
}

export const fiberKey = (f: boolean | null) => (f == null ? "unknown" : f ? "fiber" : "free");

export const FACETS: Facet[] = [
  {
    key: "fuel",
    label: "Fuel",
    mode: "any",
    options: [{ value: "Heptane", label: "Heptane" }, { value: "Methanol", label: "Methanol" }],
    values: (t) => [t.fuel],
  },
  {
    key: "diluent",
    label: "Diluent",
    mode: "any",
    options: [{ value: "N2", label: "N₂" }, { value: "CO2", label: "CO₂" }, { value: "He", label: "He" }],
    values: (t) => [t.diluent],
  },
  {
    key: "pressure",
    label: "Pressure",
    mode: "any",
    options: [
      { value: "0.7", label: "≈0.7 atm" },
      { value: "1", label: "≈1 atm" },
      { value: "2-3", label: "2–3 atm" },
    ],
    values: (t) => [pressureBand(t.p_atm)],
  },
  {
    key: "o2",
    label: "Oxygen",
    mode: "any",
    options: [
      { value: "<16.5", label: "< 16.5%" },
      { value: "16.5-21", label: "16.5–21%" },
      { value: "air", label: "21% (ISS air)" },
      { value: "21.6-30", label: "21.6–30%" },
      { value: "30+", label: "≥ 30%" },
    ],
    values: (t) => [o2Band(t.x_o2)],
  },
  {
    key: "fiber",
    label: "Droplet",
    mode: "any",
    options: [
      { value: "free", label: "Free-floating" },
      { value: "fiber", label: "On a fiber" },
      { value: "unknown", label: "Fiber unknown" },
    ],
    values: (t) => [fiberKey(t.fiber)],
  },
  {
    key: "end",
    label: "How it ended",
    mode: "any",
    options: [
      { value: "Extinction", label: "Extinction" },
      { value: "Disruption", label: "Disruption" },
      { value: "Completion", label: "Completion" },
    ],
    values: (t) => [t.end_type],
  },
  {
    key: "tag",
    label: "Has",
    mode: "all",
    options: [
      { value: "series", label: "Droplet + flame series" },
      { value: "video", label: "Video" },
      { value: "cool", label: "Cool flame (derived)" },
    ],
    values: (t) =>
      [t.has_series && "series", t.has_video && "video", t.cool_flame && "cool"].filter(
        (v): v is string => Boolean(v),
      ),
  },
];

const KEYS = FACETS.map((f) => f.key);
/** Free-floating droplets only by default: fiber tests are never mixed in silently. */
export const DEFAULT_FIBER = ["free"];
const ALL = "all";

export function fromParams(sp: URLSearchParams): Filters {
  const f = {} as Filters;
  for (const key of KEYS) {
    const raw = sp.get(key);
    f[key] = raw ? raw.split(",").filter(Boolean) : [];
  }
  const fiber = sp.get("fiber");
  f.fiber = fiber == null ? DEFAULT_FIBER : fiber === ALL ? [] : f.fiber;
  return f;
}

export function toParams(f: Filters, base?: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams(base);
  for (const key of KEYS) {
    sp.delete(key);
    if (key === "fiber") continue;
    if (f[key].length) sp.set(key, f[key].join(","));
  }
  const isDefault = f.fiber.length === 1 && f.fiber[0] === DEFAULT_FIBER[0];
  if (!isDefault) sp.set("fiber", f.fiber.length ? f.fiber.join(",") : ALL);
  return sp;
}

function facetMatches(facet: Facet, t: TestSummary, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const vals = facet.values(t);
  return facet.mode === "all"
    ? selected.every((s) => vals.includes(s))
    : selected.some((s) => vals.includes(s));
}

export function matches(t: TestSummary, f: Filters, skip?: FacetKey): boolean {
  return FACETS.every((facet) => facet.key === skip || facetMatches(facet, t, f[facet.key]));
}

export function applyFilters(tests: TestSummary[], f: Filters): TestSummary[] {
  return tests.filter((t) => matches(t, f));
}

/** Counts for a facet's options given all *other* active filters (standard faceted search). */
export function facetCounts(tests: TestSummary[], f: Filters, key: FacetKey): Map<string, number> {
  const facet = FACETS.find((x) => x.key === key)!;
  const counts = new Map<string, number>();
  for (const t of tests) {
    if (!matches(t, f, key)) continue;
    for (const v of facet.values(t)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

export type EndCounts = { Extinction: number; Disruption: number; Completion: number };

export function endCounts(tests: TestSummary[]): EndCounts {
  const c: EndCounts = { Extinction: 0, Disruption: 0, Completion: 0 };
  for (const t of tests) c[t.end_type] += 1;
  return c;
}

export function toggle(f: Filters, key: FacetKey, value: string): Filters {
  const cur = f[key];
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  return { ...f, [key]: next };
}

/** Explorer query for each overview preset group (backend service.PRESETS group ids). */
const PRESET_QUERY: Record<string, string> = {
  iss_air: "diluent=N2&pressure=1&o2=air",
  lunar: "pressure=0.7&o2=30%2B",
  co2: "diluent=CO2",
  he: "diluent=He",
  cool_flames: "tag=cool",
  clean_d2: "end=Extinction,Completion&tag=series",
  methanol: "fuel=Methanol",
  heptane: "fuel=Heptane",
};

export const presetHref = (groupId: string) =>
  `/studies/flex/tests${PRESET_QUERY[groupId] ? `?${PRESET_QUERY[groupId]}` : ""}`;
