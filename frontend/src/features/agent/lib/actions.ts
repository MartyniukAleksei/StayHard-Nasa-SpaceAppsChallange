// Пропозиція агента → маршрут застосунку. Ключі фільтрів — як у Explorer (lib/filter.ts).
import type { Proposal } from "../types.ts";

export function proposalHref(p: Proposal): string | null {
  const nos = p.params.test_nos ?? [];
  switch (p.action) {
    case "open_test":
      return nos.length === 1 ? `/studies/flex/tests/${nos[0]}` : null;
    case "open_compare":
      return nos.length >= 2 ? `/studies/flex/compare?ids=${nos.slice(0, 3).join(",")}` : null;
    case "open_tests": {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(p.params.explorer ?? {})) if (v?.length) sp.set(k, v.join(","));
      const qs = sp.toString().replace(/%2C/g, ",");
      return `/studies/flex/tests${qs ? `?${qs}` : ""}`;
    }
  }
  return null;
}
