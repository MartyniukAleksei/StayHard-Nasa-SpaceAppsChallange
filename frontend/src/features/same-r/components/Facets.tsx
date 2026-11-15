import { type Facet, type Filters, NO_FILTERS, optionCount, toggle } from "../lib/filter";
import type { TestGroup } from "../lib/tests";
import { Mark } from "./Mark";

type Props = {
  groups: TestGroup[];
  all: Facet[];
  filters: Filters;
  onChange: (f: Filters) => void;
  mark: (m: string | null) => number;
};

/** Sidebar filters, as in the FLEX explorer: several choices per group, counts per option, reset. */
export function Facets({ groups, all, filters, onChange, mark }: Props) {
  const active = all.reduce((n, f) => n + filters[f.key].length, 0);
  return (
    <details className="sr-facets" open>
      <summary>
        Filters <span className="muted mono small">{active} active</span>
      </summary>
      <div className="sr-facets-body">
        {all.map((facet) => (
          <fieldset key={facet.key} className="sr-facet">
            <legend>{facet.label}</legend>
            {facet.options.map((o) => {
              const on = filters[facet.key].includes(o.value);
              const n = optionCount(groups, filters, all, facet, o.value);
              return (
                <label key={o.value} className={on ? "sr-opt on" : "sr-opt"}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={n === 0 && !on}
                    onChange={() => onChange(toggle(filters, facet.key, o.value))}
                  />
                  <span>
                    {facet.key === "material" && <Mark i={mark(o.value)} />} {o.label}
                  </span>
                  <span className="sr-count mono">{n}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
        <button type="button" className="btn ghost" disabled={active === 0} onClick={() => onChange(NO_FILTERS)}>
          Reset
        </button>
      </div>
    </details>
  );
}
