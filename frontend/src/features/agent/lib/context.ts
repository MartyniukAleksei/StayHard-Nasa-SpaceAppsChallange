// Що користувач бачить зараз → page_context для агента (лише з URL).
import type { ExplorerParams, PageContext } from "../types.ts";

const FACETS = ["fuel", "diluent", "pressure", "o2", "fiber", "end", "tag"] as const;

export function pageContext(pathname: string, search: string, section?: string | null): PageContext {
  const sp = new URLSearchParams(search);
  const ctx: PageContext = { route: pathname };
  if (section) ctx.section = section;
  const test = /^\/studies\/flex\/tests\/(\d+)$/.exec(pathname);
  if (test) ctx.test_no = Number(test[1]);
  if (pathname === "/studies/flex/compare") {
    const ids = (sp.get("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length) ctx.ids = ids.slice(0, 3);
  }
  const sameR = /^\/studies\/same-r(?:\/|$)/.test(pathname);
  if (sameR) {
    // SAME-R pages: the agent tools call this study "samer"; its test numbers are not FLEX ones
    ctx.study = "samer";
    const t = /^\/studies\/same-r\/tests\/(\d+)$/.exec(pathname);
    if (t) ctx.test_id = t[1];
    if (pathname === "/studies/same-r/compare") {
      const ids = (sp.get("ids") ?? "").split(",").filter((s) => /^\d+$/.test(s));
      if (ids.length) ctx.test_ids = ids.slice(0, 3);
    }
  }
  if (pathname === "/studies/flex/tests") {
    const explorer: ExplorerParams = {};
    for (const k of FACETS) {
      const v = sp.get(k);
      if (v) explorer[k] = v.split(",").filter(Boolean);
    }
    const preview = Number(sp.get("test"));
    if (Number.isInteger(preview) && preview > 0) ctx.test_no = preview;
    ctx.explorer = explorer;
  }
  return ctx;
}

const CHEM: Record<string, string> = { N2: "N₂", CO2: "CO₂", He: "He", air: "21% O₂", "30+": "≥ 30% O₂" };

/** Human-readable "what the assistant sees": shown under the panel title. */
export function describeContext(ctx: PageContext): string {
  const r = ctx.route;
  let page: string;
  if (/^\/studies\/flex\/tests\/\d+$/.test(r)) page = `Test #${ctx.test_no}`;
  else if (r === "/studies/flex/tests") {
    const vals = Object.values(ctx.explorer ?? {}).flat();
    const shown = vals.slice(0, 3).map((v) => CHEM[v] ?? v);
    page = vals.length ? `Tests · ${shown.join(", ")}${vals.length > 3 ? ` +${vals.length - 3}` : ""}` : "Tests";
    if (ctx.test_no) page += ` · preview #${ctx.test_no}`;
  } else if (r === "/studies/flex/compare") page = ctx.ids?.length ? `Compare ${ctx.ids.map((n) => `#${n}`).join(", ")}` : "Compare";
  else if (r === "/studies/flex") page = "FLEX overview";
  else if (r === "/studies/flex/library") page = "Library";
  else if (ctx.study === "samer") {
    if (ctx.test_id) page = `SAME-R test ${ctx.test_id}`;
    else if (r === "/studies/same-r/compare") page = ctx.test_ids?.length ? `SAME-R compare ${ctx.test_ids.join(", ")}` : "SAME-R compare";
    else if (r === "/studies/same-r/tests") page = "SAME-R tests";
    else if (r === "/studies/same-r/library") page = "SAME-R library";
    else page = "SAME-R overview";
  } else if (r === "/") page = "Home";
  else page = r;
  return ctx.section ? `${page} · ${ctx.section}` : page;
}
