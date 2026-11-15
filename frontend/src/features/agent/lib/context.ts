// Що користувач бачить зараз → page_context для агента (лише з URL).
import type { ExplorerParams, PageContext } from "../types.ts";

const FACETS = ["fuel", "diluent", "pressure", "o2", "fiber", "end", "tag"] as const;

export function pageContext(pathname: string, search: string): PageContext {
  const sp = new URLSearchParams(search);
  const ctx: PageContext = { route: pathname };
  const test = /^\/studies\/flex\/tests\/(\d+)$/.exec(pathname);
  if (test) ctx.test_no = Number(test[1]);
  if (pathname === "/studies/flex/compare") {
    const ids = (sp.get("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length) ctx.ids = ids.slice(0, 3);
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
