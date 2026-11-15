import { useEffect, useState } from "react";
import { FACETS, toggle, type FacetKey, type Filters } from "../lib/filter";

const AXIS_FACETS: FacetKey[] = ["diluent", "pressure"];
const O2_MIN = 10;
const O2_MAX = 40;

/** Axis filters above the map: exact O₂ range and diluent / pressure (same URL state as the facets). */
export function MapControls({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className="ex-axis" role="group" aria-label="Filter the map by its axes">
      <O2Range filters={filters} onChange={onChange} />
      {AXIS_FACETS.map((key) => {
        const facet = FACETS.find((f) => f.key === key)!;
        return (
          <fieldset key={key} className="ex-axis-set">
            <legend>{facet.label}</legend>
            {facet.options.map((o) => (
              <label key={o.value} className="ex-axis-opt">
                <input
                  type="checkbox"
                  checked={filters[key].includes(o.value)}
                  onChange={() => onChange(toggle(filters, key, o.value))}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

function O2Range({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  // local text state so typing "2" on the way to "21" does not filter on every keystroke
  const [lo, setLo] = useState(filters.o2min?.toString() ?? "");
  const [hi, setHi] = useState(filters.o2max?.toString() ?? "");
  useEffect(() => setLo(filters.o2min?.toString() ?? ""), [filters.o2min]);
  useEffect(() => setHi(filters.o2max?.toString() ?? ""), [filters.o2max]);

  const parse = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));
  const commit = () => onChange({ ...filters, o2min: parse(lo), o2max: parse(hi) });
  const active = filters.o2min != null || filters.o2max != null;

  return (
    <fieldset className="ex-axis-set ex-o2">
      <legend>O₂ range, %</legend>
      <input
        type="number"
        inputMode="decimal"
        min={O2_MIN}
        max={O2_MAX}
        step={0.5}
        placeholder="from"
        aria-label="O₂ from, percent"
        value={lo}
        onChange={(e) => setLo(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <span aria-hidden="true">–</span>
      <input
        type="number"
        inputMode="decimal"
        min={O2_MIN}
        max={O2_MAX}
        step={0.5}
        placeholder="to"
        aria-label="O₂ to, percent"
        value={hi}
        onChange={(e) => setHi(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      {active && (
        <button type="button" className="btn ghost" onClick={() => onChange({ ...filters, o2min: null, o2max: null })}>
          Reset
        </button>
      )}
    </fieldset>
  );
}
