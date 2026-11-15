import { Link, useSearchParams } from "react-router";
import { testHref, useBass2Overview, useBass2Tests } from "../api";
import {
  applyFilters,
  emptyFilters,
  FACETS,
  type FacetKey,
  facetCounts,
  type Filters,
  fromParams,
  type SortKey,
  sortTests,
  toggle,
  toParams,
} from "../lib/filter";
import { firstNumber, OUTCOME_ORDER, OUTCOMES } from "../lib/outcomes";
import type { TestRow } from "../types";
import { OutcomeMark } from "./Glyph";
import { OxygenStrip, type RefLine } from "./OxygenStrip";
import "./bass2.css";

const COLS: { key: SortKey | null; label: string; hideMobile?: boolean }[] = [
  { key: "test_id", label: "Test" },
  { key: "pi", label: "Team", hideMobile: true },
  { key: null, label: "Sample" },
  { key: null, label: "Flow" },
  { key: "o2_initial_pct", label: "O₂ start, %" },
  { key: "o2_final_pct", label: "O₂ end, %", hideMobile: true },
  { key: "co2_final_pct", label: "CO₂ end, %", hideMobile: true },
  { key: "co_final_ppm", label: "CO end, ppm", hideMobile: true },
  { key: null, label: "Outcome" },
  { key: "test_date", label: "Date", hideMobile: true },
];

const SORT_KEYS = COLS.map((c) => c.key).filter(Boolean) as SortKey[];

/** BASS-II explorer: facets on the left, outcome summary, oxygen strip and the table. State in the URL. */
export function Bass2Explorer() {
  const tests = useBass2Tests();
  const ov = useBass2Overview();
  const [params, setParams] = useSearchParams();
  const filters = fromParams(params);
  const sortParam = params.get("sort") as SortKey | null;
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : "test_id";
  const desc = params.get("desc") === "1";

  const setFilters = (f: Filters) => setParams(toParams(f, params), { replace: true });
  const setSort = (k: SortKey) => {
    const p = new URLSearchParams(params);
    p.set("sort", k);
    p.set("desc", k === sort && !desc ? "1" : "0");
    setParams(p, { replace: true });
  };

  if (tests.isPending) {
    return (
      <div className="wrap band">
        <p className="muted mono">Loading tests…</p>
      </div>
    );
  }
  if (tests.isError) {
    return (
      <div className="wrap band">
        <p className="placeholder" role="alert">
          Could not load BASS-II tests ({tests.error.message}).
        </p>
      </div>
    );
  }

  const all = tests.data;
  const rows = sortTests(applyFilters(all, filters), sort, desc);
  const space = ov.data?.findings.find((f) => f.id === "rod_min_o2");
  const refs: RefLine[] = [];
  const s = firstNumber(space?.value);
  const e = firstNumber(space?.earth_value);
  if (s != null) refs.push({ x: s, label: `${s}% rods burn in space (p. ${space?.page})`, tone: "flame" });
  if (e != null) refs.push({ x: e, label: `${e}% Earth upward-spread limit (p. ${space?.page})`, tone: "ash" });

  return (
    <div className="wrap band b2x">
      <header className="b2x-head">
        <p className="b2-kicker mono">BASS-II · PSI-25 · tests</p>
        <h1 className="h-display">All burns</h1>
        <p className="lede">
          Every BASS-II test with its conditions from the NASA PSI table. Flow geometry and outcome
          come from the researchers' log in the report and are labelled <span className="tag">derived</span>.
        </p>
      </header>
      <div className="b2x-grid">
        <Facets tests={all} filters={filters} onChange={setFilters} />
        <div className="b2x-main">
          <Summary rows={rows} total={all.length} />
          {rows.length > 0 && <OxygenStrip tests={rows} refs={refs} />}
          <Table rows={rows} sort={sort} desc={desc} onSort={setSort} />
        </div>
      </div>
    </div>
  );
}

function Facets({ tests, filters, onChange }: { tests: TestRow[]; filters: Filters; onChange: (f: Filters) => void }) {
  const active = FACETS.reduce((n, f) => n + filters[f.key].length, 0);
  return (
    <details className="b2x-facets" open>
      <summary>
        Filters <span className="muted mono small">{active} active</span>
      </summary>
      <div className="b2x-facets-body">
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
        <button type="button" className="btn ghost" disabled={active === 0} onClick={() => onChange(emptyFilters())}>
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
    <fieldset className="b2x-facet">
      <legend>{props.label}</legend>
      {props.options.map((o) => {
        const n = props.counts.get(o.value) ?? 0;
        const on = props.selected.includes(o.value);
        return (
          <label key={o.value} className={on ? "b2x-opt on" : "b2x-opt"}>
            <input type="checkbox" checked={on} disabled={n === 0 && !on} onChange={() => props.onToggle(o.value)} />
            <span>{o.label}</span>
            <span className="b2x-count mono">{n}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function Summary({ rows, total }: { rows: TestRow[]; total: number }) {
  const count = (k: string) => rows.filter((t) => (t.outcome ?? "unknown") === k).length;
  const burned = rows.filter((t) => t.outcome && OUTCOMES[t.outcome].burned).length;
  return (
    <div className="b2x-summary" role="status">
      <div className="stat">
        <b>{rows.length}</b>
        <span>of {total} tests</span>
      </div>
      <ul className="b2x-ends">
        {OUTCOME_ORDER.map((k) => {
          const n = count(k);
          return n ? (
            <li key={k}>
              <OutcomeMark outcome={k} /> <b className="mono">{n}</b>
            </li>
          ) : null;
        })}
      </ul>
      <p className="b2x-note">
        <span className="tag">derived</span> Outcome is our reading of the report log (Appendix A,
        NASA/TM-20210011385). {burned} of these tests burned until the sample ran out or the crew
        stopped the fan.
      </p>
    </div>
  );
}

const fmt = (v: number | null, d = 1) => (v == null ? "—" : v.toFixed(d));

function Table({ rows, sort, desc, onSort }: { rows: TestRow[]; sort: SortKey; desc: boolean; onSort: (k: SortKey) => void }) {
  if (rows.length === 0) return <p className="placeholder">No tests match these filters.</p>;
  return (
    <div className="b2x-table-wrap">
      <table className="b2x-table">
        <thead>
          <tr>
            {COLS.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={c.hideMobile ? "hide-m" : undefined}
                aria-sort={c.key === sort ? (desc ? "descending" : "ascending") : undefined}
              >
                {c.key ? (
                  <button type="button" onClick={() => onSort(c.key!)}>
                    {c.label}
                    {c.key === sort ? (desc ? " ↓" : " ↑") : ""}
                  </button>
                ) : (
                  <span>{c.label}</span>
                )}
              </th>
            ))}
            <th scope="col">
              <span className="sr-only">Media</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.test_id}>
              <th scope="row">
                <Link to={testHref(t.test_id)} className="mono">
                  {t.test_id}
                </Link>
              </th>
              <td className="hide-m">{t.pi}</td>
              <td>{t.material}</td>
              <td>{t.flow_config ?? <span className="muted">—</span>}</td>
              <td className="mono">{fmt(t.o2_initial_pct)}</td>
              <td className="mono hide-m">
                {t.o2_final_suspect ? (
                  <span className="b2x-flag" title="Impossible value in the source table">
                    {fmt(t.o2_final_pct)} ?
                  </span>
                ) : (
                  fmt(t.o2_final_pct)
                )}
              </td>
              <td className="mono hide-m">{fmt(t.co2_final_pct, 2)}</td>
              <td className="mono hide-m">
                {t.co_over_range ? <span title="Over the sensor range in the source">over range</span> : fmt(t.co_final_ppm, 0)}
              </td>
              <td>
                <OutcomeMark outcome={t.outcome} />
                {t.outcome_confidence === "medium" && (
                  <span className="muted small" title="Ambiguous wording in the log">
                    {" "}
                    ?
                  </span>
                )}
              </td>
              <td className="mono hide-m">{t.test_date ?? "—"}</td>
              <td>{t.has_video && <span className="tag b2x-tag">video</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
