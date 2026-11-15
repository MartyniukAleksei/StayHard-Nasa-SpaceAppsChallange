import { useMemo, useState } from "react";
import { chem, num, pct } from "@/shared/lib/format";
import { CopyButton } from "@/shared/ui/CopyButton";
import { CALLOUTS_MAP, PITFALLS } from "../content";
import {
  type CoolKey,
  type EndKey,
  type Filters,
  VIEWS,
  type ViewId,
  allFilters,
  coolFlameProfile,
  coolKey,
  countBy,
  endKey,
  fuelLabel,
  hardwareNotes,
  longestBurn,
  matches,
  oxygenDrop,
  peakBurnerKelvin,
  sameConditionsWithoutCool,
  toggle,
} from "../lib/regime";
import type { About, Facts, RegimeTest } from "../types";
import { Callout, Cited } from "./Cited";
import { MarkIcon } from "./Marks";
import { END_WORDS, Panel } from "./Panel";

type Props = { tests: RegimeTest[]; facts: Facts; about: About };

const COOL_LABEL: Record<CoolKey, string> = { yes: "noted", no: "no", unrecorded: "not recorded" };
const END_LABEL: Record<EndKey, string> = { SE: "SE self-extinguished", FT: "FT flow terminated", none: "no ending recorded" };

/** Visualization 2: every PSI-159 test on one map, filterable, with the papers' caveats next to the data. */
export function RegimeMap({ tests, facts, about }: Props) {
  const [viewId, setViewId] = useState<ViewId>("p-o2");
  const [filters, setFilters] = useState<Filters>(() => allFilters(tests));
  const [selected, setSelected] = useState<string | null>(null);
  const view = VIEWS.find((v) => v.id === viewId) ?? VIEWS[0];
  const shown = useMemo(() => tests.filter((t) => matches(t, filters)), [tests, filters]);
  const sel = selected ? tests.find((t) => t.test_id === selected) : undefined;
  const fuels = useMemo(() => [...facts.fuels].sort(), [facts.fuels]);
  const byFlame = useMemo(() => countBy(tests, (t) => t.flame_type), [tests]);
  const byCool = useMemo(() => countBy(tests, coolKey), [tests]);
  const byEnd = useMemo(() => countBy(tests, endKey), [tests]);
  const byFuel = useMemo(() => countBy(tests, (t) => t.fuel), [tests]);

  const cool = useMemo(() => coolFlameProfile(tests), [tests]);
  const contrast = useMemo(() => sameConditionsWithoutCool(tests), [tests]);
  const drop = useMemo(() => oxygenDrop(tests), [tests]);
  const longest = useMemo(() => longestBurn(tests), [tests]);
  const hardware = useMemo(() => hardwareNotes(tests), [tests]);
  const peakK = useMemo(() => peakBurnerKelvin(tests), [tests]);
  const pressures = useMemo(() => {
    const v = tests.map((t) => t.p_bar).filter((x): x is number => x != null);
    return v.length ? ([Math.min(...v), Math.max(...v)] as const) : null;
  }, [tests]);

  const set = <K extends keyof Filters>(k: K, v: string) =>
    setFilters((f) => ({ ...f, [k]: toggle(f[k] as ReadonlySet<string>, v) }) as Filters);

  return (
    <section className="band cf-band" id="regime-map" aria-labelledby="cf-v2-title">
      <p className="cf-kicker">Visualization 2 · ACME CFI-G, PSI-159</p>
      <h2 id="cf-v2-title" className="h-section">
        Where the cool flames were, and what the table cannot say
      </h2>
      <p className="lede">
        All {facts.n_tests} tests of the experimental table ({facts.n_normal} normal flames, {facts.n_inverse} inverse
        flames; {facts.fuels.map(fuelLabel).join(", ")}). Hover or press a point for its row. Every position is a value from the
        table; dots with identical values are spread slightly so they stay visible.
      </p>

      <div className="cf-controls">
        <fieldset className="cf-set">
          <legend>View</legend>
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className={`tag${viewId === v.id ? " on" : ""}`} aria-pressed={viewId === v.id} onClick={() => setViewId(v.id)}>
              {v.label}
            </button>
          ))}
        </fieldset>
        <fieldset className="cf-set">
          <legend>Fuel</legend>
          {fuels.map((f) => (
            <FilterTag key={f} on={filters.fuels.has(f)} onClick={() => set("fuels", f)} label={fuelLabel(f)} n={byFuel[f] ?? 0} />
          ))}
        </fieldset>
        <fieldset className="cf-set">
          <legend>Flame type</legend>
          {(["normal", "inverse"] as const).map((f) => (
            <FilterTag key={f} on={filters.flames.has(f)} onClick={() => set("flames", f)} label={f} n={byFlame[f] ?? 0} />
          ))}
        </fieldset>
        <fieldset className="cf-set">
          <legend>Cool flame (table)</legend>
          {(["yes", "no", "unrecorded"] as const).map((k) => (
            <FilterTag key={k} on={filters.cool.has(k)} onClick={() => set("cool", k)} label={COOL_LABEL[k]} n={byCool[k] ?? 0} />
          ))}
        </fieldset>
        <fieldset className="cf-set">
          <legend>How it ended</legend>
          {(["SE", "FT", "none"] as const).map((k) => (
            <FilterTag key={k} on={filters.ends.has(k)} onClick={() => set("ends", k)} label={END_LABEL[k]} n={byEnd[k] ?? 0} />
          ))}
        </fieldset>
      </div>

      <p className="mono small cf-count" role="status">
        {shown.length} of {tests.length} tests match
      </p>

      <div className="cf-panels">
        {fuels
          .filter((f) => filters.fuels.has(f))
          .map((f) => (
            <Panel key={f} fuel={f} all={tests} view={view} filters={filters} selected={selected} onSelect={setSelected} />
          ))}
      </div>

      <ul className="chart-legend cf-legend" aria-label="Legend">
        <li><MarkIcon end="SE" shape="circle" /> self-extinguished, normal flame</li>
        <li><MarkIcon end="FT" shape="circle" /> flow terminated, normal</li>
        <li><MarkIcon end="SE" shape="square" /> inverse flame, self-extinguished</li>
        <li><MarkIcon end="FT" shape="square" /> inverse, flow terminated</li>
        <li><MarkIcon end="none" shape="circle" /> no ending recorded</li>
        <li><MarkIcon end="SE" shape="circle" cool /> cool flame noted (blue, larger)</li>
        <li className="muted">faint = filtered out</li>
      </ul>

      <TestDetail t={sel} about={about} />

      <details className="cf-table">
        <summary>Table of the {shown.length} matching tests</summary>
        <div className="body">
          <div className="cf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Test</th><th>Fuel</th><th>Flame</th><th>p, bar</th><th>XO₂ before</th><th>Burn, s</th><th>Ended</th><th>Cool flame</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.test_id} className={t.test_id === selected ? "sel" : undefined}>
                    <td><button type="button" className="cf-rowbtn" onClick={() => setSelected(t.test_id)}>{t.test_id}</button></td>
                    <td>{fuelLabel(t.fuel)}</td>
                    <td>{t.flame_type}</td>
                    <td>{num(t.p_bar, 2)}</td>
                    <td>{pct(t.x_o2)}</td>
                    <td>{num(t.burn_time_s, 0)}</td>
                    <td>{endKey(t)}</td>
                    <td>{COOL_LABEL[coolKey(t)]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <div className="cf-callouts">
        {CALLOUTS_MAP.map((c) => (
          <Callout key={c.id} label={c.label} title={c.title}>
            {c.paragraphs.map((p) => (
              <p key={p} className="small"><Cited text={p} /></p>
            ))}
            <p className="small cf-check">
              <span className="tag">checked against this table · derived</span>{" "}
              {cool.n === 0
                ? "No test in the table carries a cool-flame note."
                : `${cool.n} tests carry a cool-flame “yes”: ${cool.flameTypes.join(" and ")} ${cool.fuels.map(fuelLabel).join(", ")} flames at ${cool.pressure ? `${num(cool.pressure[0], 2)}${cool.pressure[1] - cool.pressure[0] > 0.005 ? `–${num(cool.pressure[1], 2)}` : ""} bar` : "unknown pressure"}, XO₂ ${cool.xo2 ? `${pct(cool.xo2[0])}–${pct(cool.xo2[1])}` : "unknown"} (${cool.ids.join(", ")}). ${contrast} more normal runs at that fuel and pressure carry no cool-flame “yes”.${cool.zst ? ` The table’s Zst column reads ${num(cool.zst[0], 3)}–${num(cool.zst[1], 3)} for these tests, not 0.53; the table does not define Zst, so the two numbers are not comparable until the definition is checked.` : ""}`}
            </p>
          </Callout>
        ))}
      </div>

      <h3 className="cf-h3">Four ways to misread this table</h3>
      <div className="cf-pitfalls">
        {PITFALLS.map((p) => (
          <Callout key={p.id} label="Experimental error and model caveat" title={p.title}>
            <p className="small"><Cited text={p.text} /></p>
            <p className="small cf-check">
              <span className="tag">from this table · derived</span>{" "}
              {p.id === "termination" &&
                `${facts.n_self_extinguished} tests ended by self-extinction (SE), ${facts.n_flow_terminated} by flow termination (FT) and ${byEnd.none ?? 0} have no ending recorded (many did not ignite). ${hardware.length} comments mention a burner-temperature limit, a flow cut or a manual stop.${drop ? ` Oxygen fell by up to ${num(drop.maxDrop * 100, 2)} points of XO₂ during a test (${drop.maxId}).` : ""}`}
              {p.id === "timescale" &&
                (longest
                  ? `The longest burn in the table is ${num(longest.seconds, 0, "s")} (${longest.id}); the hottest burner reading is ${peakK ? num(peakK, 0, "K") : "not recorded"}.`
                  : "No burn times in the table.")}
              {p.id === "optical" &&
                (pressures
                  ? `The table spans ${num(pressures[0], 2)}–${num(pressures[1], 2)} bar; the ${cool.n} cool-flame runs are at ${cool.pressure ? `${num(cool.pressure[0], 2)} bar` : "no recorded pressure"}.`
                  : "No pressures in the table.")}
              {p.id === "sensors" &&
                `Peak burner temperature is recorded for ${tests.filter((t) => t.peak_burner_t_c != null).length} of ${tests.length} tests and Tad (a calculated value, not a measurement) for ${tests.filter((t) => t.tad_k != null).length}.`}
            </p>
          </Callout>
        ))}
      </div>
    </section>
  );
}

function FilterTag({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button type="button" className={`tag${on ? " on" : ""}`} aria-pressed={on} onClick={onClick} disabled={n === 0}>
      {label} <span className="muted">{n}</span>
    </button>
  );
}

function TestDetail({ t, about }: { t: RegimeTest | undefined; about: About }) {
  if (!t)
    return (
      <p className="placeholder cf-detail-empty" role="note">
        Select a point to see the full table row for that test.
      </p>
    );
  return (
    <div className="cf-detail" role="region" aria-label={`Test ${t.test_id}`}>
      <h3 className="mono">
        {t.test_id} <span className="muted">· {fuelLabel(t.fuel)} · {t.flame_type} flame</span>
      </h3>
      <dl className="cf-read">
        <dt>Pressure</dt><dd>{num(t.p_bar, 2, "bar")}</dd>
        <dt>XO₂ before → after</dt><dd>{pct(t.x_o2)} → {pct(t.x_o2_after)}</dd>
        <dt>Hydrocarbon flow</dt><dd>{num(t.fuel_flow_mg_s, 2, "mg/s")}</dd>
        <dt>Adiabatic flame temp. (calculated)</dt><dd>{num(t.tad_k, 0, "K")}</dd>
        <dt>Zst (table column)</dt><dd>{num(t.zst, 3)}</dd>
        <dt>Hot ignition</dt><dd>{t.hot_ignition == null ? "—" : t.hot_ignition ? "yes" : "no"}</dd>
        <dt>Burn time</dt><dd>{num(t.burn_time_s, 0, "s")}</dd>
        <dt>Ended</dt><dd>{END_WORDS[endKey(t)]}</dd>
        <dt>Peak burner temperature</dt><dd>{num(t.peak_burner_t_c, 0, "°C")}</dd>
        <dt>Cool flame?</dt>
        <dd>
          {t.cool_flame_note ? `“${t.cool_flame_note}”` : "not recorded for this test"} <span className="tag">derived</span>
        </dd>
        <dt>Comment</dt><dd>{t.comment ?? "—"}</dd>
        <dt>Telemetry series</dt><dd>{t.has_telemetry ? "in the snapshot" : "none"}</dd>
      </dl>
      <p className="small muted">
        NASA PSI, {about.accession}, doi:{about.doi} <CopyButton text={about.citation} label="Copy citation" /> · {chem("O2")} fractions are mole fractions.
      </p>
    </div>
  );
}
