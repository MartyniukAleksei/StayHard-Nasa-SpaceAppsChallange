import { FACETS, type FacetKey, type Filters, facetCounts, fromParams, toggle } from "../lib/filter";
import type { TestSummary } from "@/features/flex-tests";

type Props = { tests: TestSummary[]; filters: Filters; onChange: (f: Filters) => void };

export function Facets({ tests, filters, onChange }: Props) {
  const active = FACETS.reduce((n, f) => n + filters[f.key].length, 0);
  return (
    <details className="ex-facets" open>
      <summary>
        Filters <span className="muted mono small">{active} active</span>
      </summary>
      <div className="ex-facets-body">
        {FACETS.map((facet) => (
          <FacetGroup
            key={facet.key}
            facetKey={facet.key}
            label={facet.label}
            options={facet.options}
            counts={facetCounts(tests, filters, facet.key)}
            selected={filters[facet.key]}
            onToggle={(v) => onChange(toggle(filters, facet.key, v))}
          />
        ))}
        <button
          type="button"
          className="btn ghost"
          onClick={() =>
            onChange(
              fromParams(new URLSearchParams()),
            )
          }
        >
          Reset
        </button>
      </div>
    </details>
  );
}

function FacetGroup(props: {
  facetKey: FacetKey;
  label: string;
  options: { value: string; label: string }[];
  counts: Map<string, number>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <fieldset className="ex-facet">
      <legend>{props.label}</legend>
      {props.options.map((o) => {
        const n = props.counts.get(o.value) ?? 0;
        const on = props.selected.includes(o.value);
        return (
          <label key={o.value} className={on ? "ex-opt on" : "ex-opt"}>
            <input
              type="checkbox"
              checked={on}
              disabled={n === 0 && !on}
              onChange={() => props.onToggle(o.value)}
            />
            <span>{o.label}</span>
            <span className="ex-count mono">{n}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
