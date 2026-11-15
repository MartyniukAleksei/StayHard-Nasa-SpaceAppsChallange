// Пропозиція агента → маршрут застосунку. Ключі фільтрів — як у Explorer (lib/filter.ts).
import type { Proposal } from "../types.ts";

export function proposalHref(p: Proposal): string | null {
  const nos = p.params.test_nos ?? [];
  if (p.params.study === "samer") {
    if (p.action === "open_test") return nos.length === 1 ? `/studies/same-r/tests/${nos[0]}` : null;
    if (p.action === "open_compare") return nos.length >= 2 ? `/studies/same-r/compare?ids=${nos.slice(0, 3).join(",")}` : null;
    return p.action === "open_tests" ? "/studies/same-r/tests" : null;
  }
  switch (p.action) {
    case "open_test":
      return nos.length === 1 ? `/studies/flex/tests/${nos[0]}` : null;
    case "open_compare":
      return nos.length >= 2 ? `/studies/flex/compare?ids=${nos.slice(0, 3).join(",")}` : null;
    case "open_video":
      return nos.length === 1 ? `/studies/flex/tests/${nos[0]}?view=video#tp-media` : null;
    case "open_replay": {
      if (nos.length !== 1) return null;
      const t = Math.max(0, Math.round((p.params.t_s ?? 0) * 100) / 100);
      return `/studies/flex/tests/${nos[0]}?view=3d&t=${t}#tp-media`;
    }
    case "open_tests": {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(p.params.explorer ?? {})) if (v?.length) sp.set(k, v.join(","));
      const qs = sp.toString().replace(/%2C/g, ",");
      return `/studies/flex/tests${qs ? `?${qs}` : ""}`;
    }
  }
  return null;
}
