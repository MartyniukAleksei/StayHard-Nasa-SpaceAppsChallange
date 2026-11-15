import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { num } from "@/shared/lib/format";
import { TimeChart, type Series as ChartSeries, type Tone } from "@/shared/ui/chart/TimeChart";
import { useSaffireDashboard, useSaffireSeriesMany } from "../api";
import { COMPARE_PRESETS, glyphOf, SIGNALS, VERDICT_LABEL, type Signal } from "../content";
import { BASE, compareHref, facetValue, MAX_COMPARE, parseIds, sampleHref, samplesHref } from "../lib/links";
import { domain, maxAcross, peakOf, points, riseFromZero, toPpm } from "../lib/series";
import type { Sample, Series } from "../types";
import { README_FLOW_30 } from "./SampleCharts";
import { Failed, Loading } from "./SaffireOverview";
import "./saffire2.css";

const TONES: Tone[] = ["ink", "s1", "ash", "s2"];

function values(s: Series, signal: Signal) {
  if (signal === "peak_t") return maxAcross(s.sample_tc);
  if (signal === "co2_rise") return riseFromZero(s.t, s.co2_pct.map(toPpm));
  return s.radiometers[0] ?? [];
}

/** 4A like FLEX: up to four samples side by side, one column each, charts on shared axes. */
export function SaffireCompare() {
  const { data, isPending, isError, error } = useSaffireDashboard();
  const [sp, setSp] = useSearchParams();
  const ids = parseIds(sp.get("ids"));
  const [signal, setSignal] = useState<Signal>("peak_t");
  const qs = useSaffireSeriesMany(ids);
  const setIds = (next: string[]) => setSp(new URLSearchParams(compareHref(next).split("?")[1] ?? ""), { replace: true });

  if (isPending) return <Loading />;
  if (isError) return <Failed message={error.message} />;
  const samples = ids.map((id) => data.samples.find((s) => s.test_id === id)).filter((s): s is Sample => Boolean(s));
  const loaded = qs.map((q) => q.data).filter((d): d is Series => d != null);
  const sig = SIGNALS.find((x) => x.id === signal)!;
  const ys = loaded.flatMap((s) => values(s, signal));
  const xMax = Math.max(1, ...loaded.map((s) => s.t[s.t.length - 1] ?? 0));
  const yDom: [number, number] = signal === "peak_t" ? [0, domain(ys)[1]] : domain(ys);
  const materials = new Set(samples.map((s) => facetValue(s, "material")));
  const flows = new Set(samples.map((s) => (README_FLOW_30.has(s.test_id) ? "30" : "20")));
  const preset = COMPARE_PRESETS.find((p) => p.ids.join() === ids.join());

  const overlay: ChartSeries[] = loaded.flatMap((s, i) => {
    const pts = points(s.t, values(s, signal));
    const tone = TONES[i % TONES.length];
    return [
      { id: s.test_id, points: pts, kind: "line" as const, tone },
      { id: `${s.test_id}-pk`, label: s.test_id, points: [peakOf(pts)], kind: "dots" as const, tone },
    ];
  });

  return (
    <div className="wrap sfc">
      <header className="sfc-head">
        <p className="sf-kicker mono">
          <Link to={BASE}>SAFFIRE-II</Link> / Compare
        </p>
        <h1 className="h-display">Compare samples</h1>
        <p className="lede">
          Up to {MAX_COMPARE} samples side by side. Charts share the same axes and start at ignition, so heat, CO₂ and radiation can
          be read directly.
        </p>
        <div className="sf-tags" role="group" aria-label="Ready-made comparisons">
          {COMPARE_PRESETS.map((p) => (
            <button key={p.id} type="button" className={`tag${preset?.id === p.id ? " on" : ""}`} aria-pressed={preset?.id === p.id} onClick={() => setIds(p.ids)}>
              {p.title}
            </button>
          ))}
        </div>
        <AddSample all={data.samples} ids={ids} onAdd={(id) => setIds([...ids, id])} />
      </header>
      {ids.length === 0 ? (
        <p className="placeholder">
          No samples selected. Pick a ready-made comparison above, tick samples in the <Link to={samplesHref()}>sample explorer</Link>,
          or add one by number.
        </p>
      ) : (
        <>
          {preset && <p className="lede">{preset.question}</p>}
          {flows.size > 1 && (
            <p className="sfc-warn" role="note">
              These samples ran at different duct flows according to the NASA Readme (20 vs 30 cm/s); the PSI table lists 20 cm/s for all.
            </p>
          )}
          {materials.size > 1 && <p className="muted small">Different materials: compare the shapes of the curves, not just the peaks.</p>}
          <div className="sfc-cols" style={{ "--n": samples.length } as React.CSSProperties}>
            {samples.map((s, i) => (
              <Column key={s.test_id} s={s} tone={TONES[i % TONES.length]} onRemove={() => setIds(ids.filter((x) => x !== s.test_id))} />
            ))}
          </div>
          <section className="sfc-chart" aria-labelledby="sfc-overlay">
            <h2 id="sfc-overlay" className="h-section">On one chart</h2>
            <div className="sf-tags" role="group" aria-label="Signal">
              {SIGNALS.map((x) => (
                <button key={x.id} type="button" className={`tag${x.id === signal ? " on" : ""}`} aria-pressed={x.id === signal} onClick={() => setSignal(x.id)}>
                  {x.label}
                </button>
              ))}
            </div>
            {loaded.length < ids.length ? (
              <p className="muted mono">Loading sensors…</p>
            ) : (
              <TimeChart
                series={overlay}
                markers={[{ x: 0, label: "ignition" }]}
                xDomain={[-30, xMax]}
                yDomain={yDom}
                xLabel="s from ignition"
                yLabel={sig.unit}
                ariaLabel={`${sig.label} for samples ${ids.join(", ")}`}
                height={300}
              />
            )}
            <p className="muted small">
              {sig.label} <span className="tag sf-derived">derived</span> · labels sit at each sample's peak.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function AddSample({ all, ids, onAdd }: { all: Sample[]; ids: string[]; onAdd: (id: string) => void }) {
  const left = all.filter((s) => !ids.includes(s.test_id));
  if (ids.length >= MAX_COMPARE || left.length === 0) return null;
  return (
    <label className="sfc-add">
      <span className="muted small">Add a sample</span>
      <select value="" onChange={(e) => e.target.value && onAdd(e.target.value)}>
        <option value="">—</option>
        {left.map((s) => (
          <option key={s.test_id} value={s.test_id}>
            {s.test_id} · {s.material}
          </option>
        ))}
      </select>
    </label>
  );
}

function Column({ s, tone, onRemove }: { s: Sample; tone: Tone; onRemove: () => void }) {
  return (
    <article className="sfc-col">
      <header className="sfc-col-head">
        <span className={`sfc-swatch tone-${tone}`} aria-hidden="true" />
        <h2 className="h-section">
          <Link to={sampleHref(s.test_id)}>{s.test_id}</Link>
        </h2>
        <button type="button" className="btn ghost" onClick={onRemove} aria-label={`Remove ${s.test_id}`}>
          Remove
        </button>
      </header>
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
        <dt>Duct flow</dt>
        <dd>{num(s.sensors?.flow_mean_cm_s, 1, "cm/s")}</dd>
        <dt>Verdict</dt>
        <dd>{VERDICT_LABEL[s.verdict]}</dd>
      </dl>
      <Link className="btn-solid sfc-3d" to={`${sampleHref(s.test_id)}#sfr-watch`}>
        Open in 3D →
      </Link>
    </article>
  );
}
