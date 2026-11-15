// Посилання джерел (ADR 0006) → куди вести в UI. Самодостатній модуль для node --test.

export type Link = { href: string; internal: boolean };

const TEST = /^\/api\/studies\/flex\/tests\/(\d+)$/;
const COMPARE = /^\/api\/studies\/flex\/compare\?(.*)$/;

/**
 * - рядок таблиці тесту → сторінка тесту в застосунку;
 * - обчислене порівняння → сторінка порівняння (≤ 3 тести);
 * - інші відносні `/api/…` (файли, PDF зі сторінкою, запити) → бекенд;
 * - абсолютні (DOI) → як є.
 */
export function sourceLink(url: string, apiBase = ""): Link {
  const t = TEST.exec(url);
  if (t) return { href: `/studies/flex/tests/${t[1]}`, internal: true };
  const c = COMPARE.exec(url);
  if (c) {
    const ids = new URLSearchParams(c[1]).getAll("ids").slice(0, 3);
    if (ids.length >= 2) return { href: `/studies/flex/compare?ids=${ids.join(",")}`, internal: true };
  }
  if (url.startsWith("/api/")) return { href: `${apiBase}${url}`, internal: false };
  return { href: url, internal: false };
}
