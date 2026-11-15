import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { compareHref, MAX_COMPARE, parseIds, useTests } from "@/features/flex-tests";
import { applyFilters, fromParams, toParams, type Filters } from "../lib/filter";
import { AnswerCard } from "./AnswerCard";
import { Facets } from "./Facets";
import { Preview } from "./Preview";
import { TestMap } from "./TestMap";
import { TestTable } from "./TestTable";
import "./explorer.css";

/** 2B master–detail: facets | answer + map + table | preview. State lives in the URL. */
export function Explorer() {
  const { data: tests, isPending, isError, error } = useTests();
  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => fromParams(sp), [sp]);
  const selected = Number(sp.get("test")) || null;
  const cmp = parseIds(sp.get("cmp"));

  const rows = useMemo(() => (tests ? applyFilters(tests, filters) : []), [tests, filters]);
  const matching = useMemo(() => new Set(rows.map((t) => t.test_no)), [rows]);

  const update = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(sp);
    mut(next);
    setSp(next, { replace: true });
  };
  const setFilters = (f: Filters) => setSp(toParams(f, sp), { replace: true });
  const select = (id: number | null) => update((p) => (id ? p.set("test", String(id)) : p.delete("test")));
  const toggleCompare = (id: number) =>
    update((p) => {
      const next = cmp.includes(id) ? cmp.filter((x) => x !== id) : [...cmp, id].slice(0, MAX_COMPARE);
      if (next.length) p.set("cmp", next.join(","));
      else p.delete("cmp");
    });

  if (isPending) return <p className="wrap band muted mono">Loading tests…</p>;
  if (isError) return <p className="wrap band placeholder" role="alert">Could not load tests ({error.message}).</p>;

  const current = tests.find((t) => t.test_no === selected) ?? null;

  return (
    <div className="wrap ex">
      <header className="ex-head">
        <p className="ov-kicker mono">
          <Link to="/studies/flex">FLEX</Link> / Tests
        </p>
        <h1 className="h-display">Test explorer</h1>
        <p className="lede">
          {tests.length} FLEX tests. Narrow them down with the filters; every number below is counted
          from the data.
        </p>
      </header>
      <div className={current ? "ex-grid with-preview" : "ex-grid"}>
        <Facets tests={tests} filters={filters} onChange={setFilters} />
        <div className="ex-main">
          <AnswerCard all={tests} rows={rows} filters={filters} />
          <TestMap
            tests={tests}
            filters={filters}
            onFilters={setFilters}
            matching={matching}
            selected={selected}
            onSelect={select}
          />
          <TestTable
            rows={rows}
            selected={selected}
            onSelect={select}
            compareIds={cmp}
            onToggleCompare={toggleCompare}
          />
        </div>
        {current && (
          <Preview
            test={current}
            inCompare={cmp.includes(current.test_no)}
            compareFull={cmp.length >= MAX_COMPARE}
            onToggleCompare={() => toggleCompare(current.test_no)}
            onClose={() => select(null)}
          />
        )}
      </div>
      {cmp.length > 0 && (
        <div className="ex-cmpbar" role="region" aria-label="Comparison selection">
          <span className="mono">
            Compare {cmp.length}/{MAX_COMPARE}: {cmp.map((id) => `#${id}`).join(", ")}
          </span>
          <Link className="btn" to={compareHref(cmp)}>
            Compare
          </Link>
          <button type="button" className="btn ghost" onClick={() => update((p) => p.delete("cmp"))}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
