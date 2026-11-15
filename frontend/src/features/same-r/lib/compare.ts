// SAME-R routes. The compare selection lives in the URL (?ids=73,53), so it can be shared as a link.

export const BASE_PATH = "/studies/same-r";
export const TESTS_PATH = `${BASE_PATH}/tests`;
export const COMPARE_PATH = `${BASE_PATH}/compare`;
export const LIBRARY_PATH = `${BASE_PATH}/library`;
export const MAX_COMPARE = 3;

export const testHref = (n: number) => `${TESTS_PATH}/${n}`;

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
