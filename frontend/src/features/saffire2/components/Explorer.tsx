import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { num } from "@/shared/lib/format";
import { TimeChart } from "@/shared/ui/chart/TimeChart";
import { useSaffireDashboard, useSaffireSeries } from "../api";
import { glyphOf, VERDICT_LABEL } from "../content";
import { applyFilters, BASE, compareHref, FACETS, facetValue, fromParams, MAX_COMPARE, parseIds, sampleHref, toParams, type Facet, type Filters } from "../lib/links";
import { maxAcross, points } from "../lib/series";
import type { Sample } from "../types";
import { Failed, Loading } from "./SaffireOverview";
import "./saffire2.css";

const FACET_LABEL: Record<Facet, string> = { material: "Material", flow: "Flow direction", outcome: "Microgravity", verdict: "Space vs Earth" };
const valueLabel = (f: Facet, v: string) => (f === "verdict" ? VERDICT_LABEL[v as Sample["verdict"]] : v);

/** 2B master–detail like the FLEX explorer: facets | answer + card map + table | preview. */
export function SampleExplorer() {
  const { data, isPending, isError, error } = useSaffireDashboard();
  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => fromParams(sp), [sp]);
  const selected = sp.get("sample");
  const cmp = parseIds(sp.get("cmp"));
  const samples = data?.samples ?? [];
  const rows = useMemo(() => applyFilters(samples, filters), [samples, filters]);

  const update = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(sp);
    mut(next);
    setSp(next, { replace: true });
  };
  const setFilters = (f: Filters) => setSp(toParams(f, sp), { replace: true });
  const select = (id: string | null) => update((p) => (id ? p.set("sample", id) : p.delete("sample")));
  const toggleCompare = (id: string) =>
    update((p) => {
      const next = cmp.includes(id) ? cmp.filter((x) => x !== id) : [...cmp, id].slice(0, MAX_COMPARE);
      if (next.length) p.set("cmp", next.join(","));
      else p.delete("cmp");
    });

  if (isPending) return <Loading />;
  if (isError) return <Failed message={error.message} />;
  const current = samples.find((s) => s.test_id === selected) ?? null;
  const matching = new Set(rows.map((r) => r.test_id));

  return (
    <div className="wrap sfx">
      <header className="sfx-head">
        <div>
          <p className="sf-kicker mono">
            <Link to={BASE}>SAFFIRE-II</Link> / Samples
          </p>
          <h1 className="h-display">Sample explorer</h1>
          <p className="lede">
            {samples.length} Saffire-II samples, one card, one flight. Narrow them down with the filters; every number below
            comes from the experiment table or the flight sensors.
          </p>
        </div>
        <FindSample samples={samples} />
      </header>
      <div className="sfx-grid">
        <Facets samples={samples} filters={filters} onChange={setFilters} />
        <div className="sfx-main">
          <Answer all={samples} rows={rows} />
          <CardMap samples={samples} matching={matching} selected={selected} onSelect={select} />
          <p className="sfx-legend mono small">
            Strips as on the card (Readme Fig. 1), air flows up · ink = burned length in µg (table) · faint = filtered
            out · click a strip to preview
          </p>
          <Table rows={rows} selected={selected} onSelect={select} cmp={cmp} onToggle={toggleCompare} />
        </div>
        {current && (
          <Preview
            s={current}
            inCompare={cmp.includes(current.test_id)}
            full={cmp.length >= MAX_COMPARE}
            onToggle={() => toggleCompare(current.test_id)}
            onClose={() => select(null)}
          />
        )}
      </div>
      {cmp.length > 0 && (
        <div className="sfx-cmpbar" role="region" aria-label="Comparison selection">
          <span className="mono">
            Compare {cmp.length}/{MAX_COMPARE}: {cmp.join(", ")}
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

function Facets({ samples, filters, onChange }: { samples: Sample[]; filters: Filters; onChange: (f: Filters) => void }) {
  const active = FACETS.reduce((n, f) => n + filters[f].length, 0);
  return (
    <details className="sfx-facets" open>
      <summary>
        Filters {active > 0 && <span className="mono small muted">{active} active</span>}
      </summary>
      <div className="sfx-facets-body">
        {FACETS.map((f) => {
          const values = [...new Set(samples.map((s) => facetValue(s, f)))];
          return (
            <fieldset key={f} className="sfx-facet">
              <legend>{FACET_LABEL[f]}</legend>
              {values.map((v) => {
                const on = filters[f].includes(v);
                const n = samples.filter((s) => facetValue(s, f) === v).length;
                return (
                  <label key={v} className={on ? "sfx-opt on" : "sfx-opt"}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onChange({ ...filters, [f]: on ? filters[f].filter((x) => x !== v) : [...filters[f], v] })}
                    />
                    <span>{valueLabel(f, v)}</span>
                    <span className="mono sfx-count">{n}</span>
                  </label>
                );
              })}
            </fieldset>
          );
        })}
        {active > 0 && (
          <button type="button" className="btn ghost" onClick={() => onChange({ material: [], flow: [], outcome: [], verdict: [] })}>
            Clear filters
          </button>
        )}
      </div>
    </details>
  );
}

function Answer({ all, rows }: { all: Sample[]; rows: Sample[] }) {
  const burned = rows.filter((s) => (s.ug_burn_cm ?? 0) > 0).length;
  const stricter = rows.filter((s) => s.verdict === "earth_stricter").length;
  return (
    <div className="sfx-answer">
      <div className="stat">
        <b>{rows.length}</b>
        <span>of {all.length} samples</span>
      </div>
      <div className="stat">
        <b>{burned}</b>
        <span>burned in µg</span>
      </div>
      <div className="stat">
        <b>{stricter}</b>
        <span>1g test stricter</span>
      </div>
      <p className="sfx-note">Burned = any burned length in the experiment table. Verdict compares µg with the 1g test (derived).</p>
    </div>
  );
}

/** The card as a map: nine strips in their real positions, filled to the burned length. */
function CardMap({ samples, matching, selected, onSelect }: { samples: Sample[]; matching: Set<string>; selected: string | null; onSelect: (id: string) => void }) {
  const W = 330;
  const H = 318;
  return (
    <div className="sfx-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Sample card map">
        {samples.map((s) => {
          const n = Number(s.test_id.split("-")[1]);
          const x = 40 + ((n - 1) % 3) * 100;
          const y = 14 + Math.floor((n - 1) / 3) * 92;
          const h = 70;
          const burned = Math.min(1, (s.ug_burn_cm ?? 0) / 29) * h;
          const top = s.flow_direction === "opposed";
          const cls = ["sfx-strip", matching.has(s.test_id) ? "" : "off", selected === s.test_id ? "sel" : ""].join(" ");
          return (
            <g
              key={s.test_id}
              className={cls}
              role="button"
              tabIndex={0}
              aria-label={`Sample ${s.test_id}, ${s.material}, burned ${s.ug_burn_length_raw} in microgravity`}
              onClick={() => onSelect(s.test_id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(s.test_id)}
            >
              <rect className="hit" x={x - 10} y={y - 4} width={70} height={h + 22} />
              <rect className="strip" x={x + 14} y={y} width={22} height={h} />
              {burned > 0 && <rect className="burn" x={x + 14} y={top ? y : y + h - burned} width={22} height={burned} />}
              <text x={x + 25} y={y + h + 14} textAnchor="middle">
                {glyphOf(s.material).glyph} {s.test_id}
              </text>
            </g>
          );
        })}
        <text x={W / 2} y={H - 2} textAnchor="middle" className="flow">↑ air flow</text>
      </svg>
    </div>
  );
}

function Table({ rows, selected, onSelect, cmp, onToggle }: { rows: Sample[]; selected: string | null; onSelect: (id: string) => void; cmp: string[]; onToggle: (id: string) => void }) {
  if (rows.length === 0) return <p className="placeholder">No sample matches these filters.</p>;
  return (
    <div className="sfx-table-wrap">
      <table className="sfx-table">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Compare</span></th>
            <th scope="col">Sample</th>
            <th scope="col">Material</th>
            <th scope="col">Thickness</th>
            <th scope="col">Flow</th>
            <th scope="col">µg burned</th>
            <th scope="col">1g burned</th>
            <th scope="col">Burn time</th>
            <th scope="col">Peak T</th>
            <th scope="col">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.test_id} className={selected === s.test_id ? "sel" : ""} onClick={() => onSelect(s.test_id)}>
              <td onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" aria-label={`Compare ${s.test_id}`} checked={cmp.includes(s.test_id)} disabled={!cmp.includes(s.test_id) && cmp.length >= MAX_COMPARE} onChange={() => onToggle(s.test_id)} />
              </td>
              <td>
                <button type="button" className="sfx-rowbtn" onClick={() => onSelect(s.test_id)}>
                  {s.test_id}
                </button>
              </td>
              <td>{glyphOf(s.material).glyph} {s.material}</td>
              <td className="mono">{s.thickness_raw}</td>
              <td>{s.flow_direction}</td>
              <td className="mono">{s.ug_burn_length_raw}</td>
              <td className="mono">{s.g1_burn_length_raw}</td>
              <td className="mono">{s.burn_time_s == null ? "—" : `${s.burn_time_s} s`}</td>
              <td className="mono">{num(s.sensors?.peak_sample_t_c, 0, "°C")}</td>
              <td>{VERDICT_LABEL[s.verdict]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Preview({ s, inCompare, full, onToggle, onClose }: { s: Sample; inCompare: boolean; full: boolean; onToggle: () => void; onClose: () => void }) {
  const q = useSaffireSeries(s.test_id);
  const peak = q.data ? points(q.data.t, maxAcross(q.data.sample_tc)) : [];
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="sfx-preview"
      aria-label={`Preview of sample ${s.test_id}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <div className="sfx-preview-head">
        <h2 className="h-section">{s.test_id}</h2>
        <button type="button" className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mono small">
        {glyphOf(s.material).glyph} {s.material} · {s.thickness_raw} · {s.flow_direction}
      </p>
      <dl className="sfx-kv">
        <dt>µg burned</dt>
        <dd>{s.ug_burn_length_raw}</dd>
        <dt>1g burned</dt>
        <dd>{s.g1_burn_length_raw}</dd>
        <dt>Burn time</dt>
        <dd>{s.burn_time_s == null ? "did not burn" : `${s.burn_time_s} s`}</dd>
        <dt>Peak sample T</dt>
        <dd>{num(s.sensors?.peak_sample_t_c, 0, "°C")}</dd>
        <dt>CO₂ rise</dt>
        <dd>{s.sensors?.co2_rise_pct == null ? "—" : `${Math.round(s.sensors.co2_rise_pct * 10000)} ppm`}</dd>
        <dt>Verdict</dt>
        <dd>{VERDICT_LABEL[s.verdict]} (derived)</dd>
      </dl>
      {peak.length > 0 && (
        <TimeChart
          series={[{ id: "pk", label: "hottest TC", points: peak, kind: "line" }]}
          markers={[{ x: 0, label: "ignition" }]}
          xLabel="s from ignition"
          yLabel="°C"
          height={150}
          ariaLabel={`Hottest sample thermocouple over time, sample ${s.test_id}`}
        />
      )}
      <div className="sfx-preview-actions">
        <Link to={sampleHref(s.test_id)} className="btn">
          Open sample
        </Link>
        <button type="button" className="btn ghost" onClick={onToggle} disabled={!inCompare && full} aria-pressed={inCompare}>
          {inCompare ? "Remove from compare" : "Add to compare"}
        </button>
      </div>
    </dialog>
  );
}

/** "Go to a sample": type 2-N (or just N), open its page. Ids are checked against the data. */
function FindSample({ samples }: { samples: Sample[] }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const ids = samples.map((s) => s.test_id);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    const sid = /^[0-9]$/.test(v) ? `2-${v}` : v;
    if (!ids.includes(sid)) {
      setError(`There is no sample ${v || "?"} in Saffire-II (samples ${ids[0]}…${ids[ids.length - 1]}).`);
      return;
    }
    setError(null);
    navigate(sampleHref(sid));
  };
  return (
    <form className="sfx-find" role="search" onSubmit={submit}>
      <label className="sfx-find-label mono" htmlFor={`${id}-n`}>
        Go to a sample
      </label>
      <div className="sfx-find-row">
        <input
          id={`${id}-n`}
          type="text"
          placeholder={`${ids[0]}…${ids[ids.length - 1]}`}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-e` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className="btn-solid">
          Open →
        </button>
      </div>
      {error && (
        <p id={`${id}-e`} className="sfx-find-error small" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
