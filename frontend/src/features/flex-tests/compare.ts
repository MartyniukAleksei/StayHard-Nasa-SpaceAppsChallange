// Compare selection lives in the URL (?ids=35,207,28), so it can be shared as a link.

export const MAX_COMPARE = 3;
export const COMPARE_PATH = "/studies/flex/compare";

export function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  const ids = raw
    .split(",")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}

export const compareHref = (ids: number[]) =>
  ids.length ? `${COMPARE_PATH}?ids=${ids.slice(0, MAX_COMPARE).join(",")}` : COMPARE_PATH;

export const testHref = (id: number) => `/studies/flex/tests/${id}`;
