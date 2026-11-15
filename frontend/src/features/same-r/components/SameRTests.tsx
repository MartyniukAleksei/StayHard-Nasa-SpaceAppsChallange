import { useMemo, useState } from "react";
import { Link } from "react-router";
import { FindTest } from "@/shared/ui/FindTest";
import { useSameRTests } from "../api";
import { compareHref, MAX_COMPARE, testHref } from "../lib/compare";
import { facets, matches, NO_FILTERS, type Filters } from "../lib/filter";
import { groupTests, markIndexer, materials, type TestGroup } from "../lib/tests";
import { LoadError, Loading } from "./Common";
import { Facets } from "./Facets";
import { Mark } from "./Mark";
import { Preview } from "./Preview";
import { TestMap } from "./TestMap";
import "./same-r.css";

// units only on numbers: the table also holds text such as "n/a"
const cell = (v: number | string | null, unit = "") => (v == null ? "—" : typeof v === "number" ? `${v}${unit}` : v);

/** All SAME-R tests: sidebar filters, a map with selectable axes, the table, and picks for Compare. */
export function SameRTests() {
  const { data, isPending, isError, error } = useSameRTests();
  const groups = useMemo(() => groupTests(data?.tests ?? []), [data]);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [picked, setPicked] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  if (isPending) return <Loading what="tests" />;
  if (isError) return <LoadError message={error.message} />;
  const mark = markIndexer(groups);
  const all = facets(materials(groups).map(([m]) => m));
  const shown = groups.filter((g) => matches(g, f, all));
  const hits = new Set(shown.map((g) => g.test_no));
  const current = groups.find((g) => g.test_no === selected) ?? null;
  const toggle = (n: number) =>
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length < MAX_COMPARE ? [...p, n] : p));

  return (
    <div className="wrap band sr-tests">
      <header className="sr-tests-head">
        <div>
          <h1 className="h-display">Tests</h1>
          <p className="lede">
            Click a mark on the map for a quick look, or a test number for its 3D replay, telemetry and particle images.
            Tick up to {MAX_COMPARE} to compare.
          </p>
        </div>
        <FindTest nos={groups.map((g) => g.test_no)} href={testHref} study="SAME-R" />
      </header>
      <div className="sr-grid">
        <Facets groups={groups} all={all} filters={f} onChange={setF} mark={mark} />
        <div className="sr-main">
      <Summary shown={shown} total={groups.length} mark={mark} />
      <TestMap groups={groups} hits={hits} href={testHref} onSelect={setSelected} />
      <div className="sr-compare-bar" role="status">
        <span className="mono small muted">
          {picked.length ? `Picked: ${picked.map((n) => `#${n}`).join(", ")}` : "Nothing picked to compare"}
        </span>
        {picked.length > 0 ? (
          <Link className="btn" to={compareHref(picked)}>
            Compare {picked.length}
          </Link>
        ) : (
          <button type="button" className="btn" disabled>
            Compare
          </button>
        )}
      </div>
      <div className="sr-table-wrap">
        <table className="sr-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Compare</span>
              </th>
              <th scope="col">Test</th>
              <th scope="col">Material</th>
              <th scope="col">Description</th>
              <th scope="col">Date, 2010</th>
              <th scope="col">Heater Rt/R0</th>
              <th scope="col">Aged row</th>
              <th scope="col">Telemetry</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ test_no, main, aged }) => {
              const on = picked.includes(test_no);
              return (
                <tr key={test_no}>
                  <td>
                    <label className="sr-pick">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!on && picked.length >= MAX_COMPARE}
                        onChange={() => toggle(test_no)}
                      />
                      <span className="sr-only">Compare test {main.test_id}</span>
                    </label>
                  </td>
                  <td>
                    <Link to={testHref(test_no)} className="mono">
                      #{main.test_id}
                    </Link>
                  </td>
                  <td>{cell(main.material)}</td>
                  <td>{cell(main.description)}</td>
                  <td className="mono">{cell(main.date_2010)}</td>
                  <td className="mono">{cell(main.heater_rt_r0)}</td>
                  <td className="mono">{aged ? `${aged.test_id} · ${cell(aged.net_aging_s, " s")}` : "—"}</td>
                  <td className="mono">{main.has_timeseries ? "1 Hz" : "none"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        </div>
      </div>
      {current && (
        <Preview
          g={current}
          mark={mark(current.main.material)}
          inCompare={picked.includes(current.test_no)}
          compareFull={picked.length >= MAX_COMPARE}
          onToggleCompare={() => toggle(current.test_no)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/** How many tests match, per material, and what was measured in them. Counts only, from the data. */
function Summary({ shown, total, mark }: { shown: TestGroup[]; total: number; mark: (m: string | null) => number }) {
  const n = (f: (g: TestGroup) => boolean) => shown.filter(f).length;
  return (
    <section className="sr-summary" aria-live="polite">
      <div className="stat">
        <b>{shown.length}</b>
        <span>of {total} tests match</span>
      </div>
      <ul className="sr-summary-mats mono">
        {materials(shown).map(([m, c]) => (
          <li key={m}>
            <Mark i={mark(m)} /> {m} {c}
          </li>
        ))}
      </ul>
      <p className="sr-summary-note small muted">
        {n((g) => g.main.has_timeseries)} with telemetry · {n((g) => g.aged != null)} measured again after aging ·{" "}
        {n((g) => g.main.has_tem === true)} with TEM images
      </p>
    </section>
  );
}
