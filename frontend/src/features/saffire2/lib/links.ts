// Routes and URL state for the Saffire-II pages (no imports from "@/": runs under node --test).

export const BASE = "/studies/saffire2";
export const MAX_COMPARE = 4;
const ID_RE = /^2-[1-9]$/;

export const sampleHref = (id: string) => `${BASE}/samples/${id}`;
export const samplesHref = () => `${BASE}/samples`;

export function parseIds(raw: string | null | undefined): string[] {
  const out: string[] = [];
  for (const part of (raw ?? "").split(",")) {
    const id = part.trim();
    if (ID_RE.test(id) && !out.includes(id)) out.push(id);
    if (out.length === MAX_COMPARE) break;
  }
  return out;
}

export const compareHref = (ids: string[]) =>
  ids.length ? `${BASE}/compare?ids=${parseIds(ids.join(",")).join(",")}` : `${BASE}/compare`;

export type Facet = "material" | "flow" | "outcome" | "verdict";
export type Filters = Record<Facet, string[]>;
export const FACETS: Facet[] = ["material", "flow", "outcome", "verdict"];

export type FacetInput = { material: string; flow_direction: string; ug_burn_cm: number | null; verdict: string };

/** Value of a facet for one sample. Material groups follow the Readme legend. */
export function facetValue(s: FacetInput, f: Facet): string {
  if (f === "material") {
    if (/nomex/i.test(s.material)) return "PMMA & Nomex";
    if (/pmma/i.test(s.material)) return "PMMA";
    if (/sibal|cotton/i.test(s.material)) return "SIBAL fabric";
    return "Silicone";
  }
  if (f === "flow") return s.flow_direction || "unknown";
  if (f === "outcome") return (s.ug_burn_cm ?? 0) > 0 ? "burned in µg" : "did not burn in µg";
  return s.verdict;
}

export function fromParams(sp: URLSearchParams): Filters {
  const out = {} as Filters;
  for (const f of FACETS) out[f] = sp.getAll(f);
  return out;
}

export function toParams(filters: Filters, base: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base);
  for (const f of FACETS) {
    next.delete(f);
    filters[f].forEach((v) => next.append(f, v));
  }
  return next;
}

export function applyFilters<T extends FacetInput>(rows: T[], filters: Filters): T[] {
  return rows.filter((s) => FACETS.every((f) => filters[f].length === 0 || filters[f].includes(facetValue(s, f))));
}
