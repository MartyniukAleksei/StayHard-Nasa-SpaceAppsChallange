import type { TestGroup } from "./tests.ts";

// Sidebar facets for the SAME-R tests. Material and aging: any ticked option matches.
// "Has": every ticked item must be present (the detector set changed between runs, docs/data/same_r.md §4).

export type FacetKey = "material" | "aging" | "has";
export type Filters = Record<FacetKey, string[]>;
export type Option = { value: string; label: string; test: (g: TestGroup) => boolean };
export type Facet = { key: FacetKey; label: string; all: boolean; options: Option[] };

export const NO_FILTERS: Filters = { material: [], aging: [], has: [] };

const detector = (col: string) => (g: TestGroup) => (g.main.active_detectors ?? []).includes(col);

export function facets(materials: string[]): Facet[] {
  return [
    {
      key: "material",
      label: "Material",
      all: false,
      options: materials.map((m) => ({ value: m, label: m, test: (g) => g.main.material === m })),
    },
    {
      key: "aging",
      label: "Aging",
      all: false,
      options: [
        { value: "aged", label: "Also measured after aging", test: (g) => Boolean(g.aged) },
        { value: "fresh", label: "Fresh only", test: (g) => !g.aged },
      ],
    },
    {
      key: "has",
      label: "Has (all ticked)",
      all: true,
      options: [
        { value: "sts_v", label: "STS ionization detector", test: detector("sts_v") },
        { value: "iss_obscuration_v", label: "ISS obscuration detector", test: detector("iss_obscuration_v") },
        { value: "ion_a_v", label: "Ion A detector", test: detector("ion_a_v") },
        { value: "tem", label: "TEM particle images", test: (g) => Boolean(g.main.has_tem) },
      ],
    },
  ];
}

export function matches(g: TestGroup, f: Filters, all: Facet[]): boolean {
  return all.every((facet) => {
    const on = facet.options.filter((o) => f[facet.key].includes(o.value));
    if (on.length === 0) return true;
    return facet.all ? on.every((o) => o.test(g)) : on.some((o) => o.test(g));
  });
}

export const toggle = (f: Filters, key: FacetKey, v: string): Filters => ({
  ...f,
  [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v],
});

/** How many tests the option would show: added to its group for "all" facets, alone in its group otherwise. */
export function optionCount(groups: TestGroup[], f: Filters, all: Facet[], facet: Facet, v: string): number {
  const next = { ...f, [facet.key]: facet.all ? [...new Set([...f[facet.key], v])] : [v] };
  return groups.filter((g) => matches(g, next, all)).length;
}
