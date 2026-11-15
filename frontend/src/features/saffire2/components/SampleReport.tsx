import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { num } from "@/shared/lib/format";
import { useSaffireDashboard, useSaffireSampleFiles } from "../api";
import { glyphOf, VERDICT_LABEL } from "../content";
import { BASE, compareHref, facetValue, sampleHref, samplesHref } from "../lib/links";
import type { Sample } from "../types";
import { README_FLOW_30, SampleCharts } from "./SampleCharts";
import { Failed, Loading } from "./SaffireOverview";
import "./saffire2.css";

/** Renders the 3D view of one sample; `onT` reports seconds from ignition to the charts. */
export type WatchSlot = (id: string, onT: (t: number | null) => void) => ReactNode;

/** 3A: a long report of one sample, top to bottom, like the FLEX test page. */
export function SampleReport({ id, watch }: { id: string; watch?: WatchSlot }) {
  const { data, isPending, isError, error } = useSaffireDashboard();
  const [t, setT] = useState<number | null>(null);
  const { hash } = useLocation();
  // the sections exist only after the data loads: jump to #sfr-watch (or any #section) then
  const ready = !!data;
  useEffect(() => {
    if (ready && hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "start" });
  }, [ready, hash, id]);
  if (isPending) return <Loading />;
  if (isError) return <Failed message={error.message} />;
  const s = data.samples.find((x) => x.test_id === id);
  if (!s) {
    return (
      <div className="wrap band">
        <p className="placeholder" role="alert">
          Sample {id} is not in Saffire-II (samples are 2-1 … 2-9).
        </p>
        <Link className="btn" to={samplesHref()}>
          Back to all samples
        </Link>
      </div>
    );
  }
  const related = data.samples.filter((x) => x.test_id !== id && facetValue(x, "material") === facetValue(s, "material"));
  return (
    <article className="wrap sfr" key={id}>
      <Header s={s} />
      <section className="sfr-sec" aria-labelledby="sfr-what">
        <h2 id="sfr-what" className="h-section">What happened</h2>
        <Summary s={s} />
      </section>
      <section className="sfr-sec" aria-labelledby="sfr-watch">
        <h2 id="sfr-watch" className="h-section">Watch</h2>
        <p className="lede">
          A 3D replay of this sample drawn from the flight data and the experiment table. Play it or drag the timeline:
          the blue cursor on every chart below follows the scene.
        </p>
        {watch ? watch(id, setT) : null}
      </section>
      <section className="sfr-sec" aria-labelledby="sfr-sensors">
        <h2 id="sfr-sensors" className="h-section">Sensors</h2>
        <SampleCharts id={id} cursor={t} />
      </section>
      <Params s={s} notes={data.notes} />
      <Related s={s} related={related} />
      <Files id={id} />
    </article>
  );
}

function Header({ s }: { s: Sample }) {
  // a non-numeric table cell ("See Fig. 5") stays out of the title; the flag below quotes it
  const title = [s.material, s.thickness_mm != null ? `${s.thickness_mm} mm` : null, `${s.flow_direction} flow`].filter(Boolean).join(", ");
  return (
    <header className="sfr-head">
      <p className="sf-kicker mono">
        <Link to={BASE}>SAFFIRE-II</Link> / <Link to={samplesHref()}>Samples</Link> / {s.test_id}
      </p>
      <h1 className="h-display">
        Sample {s.test_id}: {title}
      </h1>
      <div className="sfr-tags">
        <span className="tag on">{VERDICT_LABEL[s.verdict]} · derived</span>
        <span className="tag">
          {glyphOf(s.material).glyph} {facetValue(s, "material")}
        </span>
        <span className="tag">{facetValue(s, "outcome")}</span>
      </div>
      <ul className="sfr-flags">
        {README_FLOW_30.has(s.test_id) && <li>Flow: the PSI table says 20 cm/s, the NASA Readme (Table 1) says 30 cm/s for this sample.</li>}
        {s.material_filled_down && <li>Material is blank in the PSI table for this row; it is carried down from the row above.</li>}
        {s.thickness_mm == null && <li>Thickness in the table is not a number: “{s.thickness_raw}”.</li>}
        {/&/.test(s.material) && <li>Two materials on one strip: 1g and µg results describe different parts, so no verdict is given.</li>}
      </ul>
      <div className="sfr-actions">
        <Link className="btn" to={compareHref([s.test_id])}>
          Compare with…
        </Link>
      </div>
    </header>
  );
}

/** Plain-language summary built only from table values (each clause names its source column). */
function Summary({ s }: { s: Sample }) {
  const ug =
    (s.ug_burn_cm ?? 0) <= 0
      ? "In microgravity it did not keep burning after the igniter switched off (burned length ~0)."
      : s.ug_spread.note === "Note 4"
        ? `In microgravity the flame stayed anchored at the base for ${s.burn_time_s} s; about ${s.ug_burn_cm} cm of the strip was visibly damaged (Notes 3–4).`
        : /&/.test(s.material)
          ? `In microgravity the PMMA part burned away (${s.burn_time_s} s), but the Nomex above it did not ignite (Note 2).`
          : `In microgravity it burned ${s.ug_burn_cm} cm in ${s.burn_time_s} s, spreading at ${s.ug_spread.lo} mm/s.`;
  const g1len = /^complete/i.test(s.g1_burn_length_raw) ? "the full length" : s.g1_burn_length_raw;
  const g1 = s.g1_spread.accelerating
    ? `In the 1g upward test it burned ${g1len}, accelerating.`
    : `In the 1g upward test it burned ${g1len}${s.g1_spread.lo != null ? ` at ${s.g1_spread.lo} mm/s` : ""}.`;
  return (
    <div className="sfr-summary">
      <p>
        {ug} {g1}
      </p>
      <p className="muted small">
        Source: PSI experiment table (burned length, burn time, spread rate, 1g result). Verdict “{VERDICT_LABEL[s.verdict]}” is our
        comparison of the two burned lengths.
      </p>
    </div>
  );
}

function Params({ s, notes }: { s: Sample; notes: Record<string, string> }) {
  const st = s.sensors;
  const rows: [string, string][] = [
    ["Material (table)", s.material],
    ["Thickness (table)", s.thickness_raw || "—"],
    ["Length (table)", s.length_raw || "—"],
    ["Air flow (table)", `${num(s.air_flow_cm_s, 0, "cm/s")} · ${s.flow_direction}`],
    ["O₂ (table, Note 1)", s.o2_pct_table == null ? "range in table" : `${s.o2_pct_table}%`],
    ["Igniter (table)", `${num(s.ignition_power_w, 0, "W")} × ${num(s.ignition_time_s, 1, "s")}`],
    ["Burn time (table)", s.burn_time_s == null ? "—" : `${s.burn_time_s} s`],
    ["µg burned length / spread (table)", `${s.ug_burn_length_raw} / ${s.ug_spread_raw}`],
    ["1g burned length / spread (table)", `${s.g1_burn_length_raw} / ${s.g1_spread_rate_raw}`],
    ["Camera sets (table)", [s.camera1, s.camera2].filter((c) => c && c !== "n/a").join(", ") || "—"],
    ["Recording length (sensors)", num(st?.duration_s, 0, "s")],
    ["Igniter on (sensors, derived)", num(st?.igniter_on_s, 1, "s")],
    ["Peak sample T (sensors)", num(st?.peak_sample_t_c, 0, "°C")],
    ["Peak plume T (sensors)", num(st?.peak_plume_t_c, 0, "°C")],
    ["CO₂ rise (sensors, derived)", st?.co2_rise_pct == null ? "—" : `${Math.round(st.co2_rise_pct * 10000)} ppm`],
    ["O₂ (sensor mean)", num(st?.o2_mean_pct, 2, "%")],
    ["Duct flow (anemometer mean ± sd)", `${num(st?.flow_mean_cm_s, 1)} ± ${num(st?.flow_sd_cm_s, 1, "cm/s")}`],
    ["Pressure / humidity (means)", `${num(st?.pressure_mean_psia, 2, "psia")} / ${num(st?.humidity_mean_pct, 1, "%")}`],
  ];
  const cited = Object.entries(notes).filter(([k]) => [s.ug_burn_length_raw, s.ug_spread_raw, "Note 1"].some((v) => v.toLowerCase().includes(`note ${k}`)));
  return (
    <section className="sfr-sec" aria-labelledby="sfr-params">
      <h2 id="sfr-params" className="h-section">Parameters</h2>
      <dl className="sfr-kv">
        {rows.map(([k, v]) => (
          <div key={k} className="sfr-kv-row">
            <dt className="muted">{k}</dt>
            <dd className="mono">{v}</dd>
          </div>
        ))}
      </dl>
      {cited.length > 0 && (
        <ol className="sf-notes">
          {cited.map(([k, v]) => (
            <li key={k} value={Number(k)}>
              <span className="muted">{v}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Related({ s, related }: { s: Sample; related: Sample[] }) {
  return (
    <section className="sfr-sec" aria-labelledby="sfr-rel">
      <h2 id="sfr-rel" className="h-section">Same material</h2>
      {related.length === 0 ? (
        <p className="muted">No other sample of {facetValue(s, "material")} on the card.</p>
      ) : (
        <ul className="sfr-rel">
          {related.map((r) => (
            <li key={r.test_id}>
              <Link to={sampleHref(r.test_id)} className="mono">
                {r.test_id}
              </Link>
              <span className="muted small">
                {r.thickness_raw} · {r.flow_direction} · µg {r.ug_burn_length_raw} · 1g {r.g1_burn_length_raw}
              </span>
              <Link className="small" to={compareHref([s.test_id, r.test_id])}>
                compare
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Files({ id }: { id: string }) {
  const q = useSaffireSampleFiles(id);
  return (
    <section className="sfr-sec" aria-labelledby="sfr-files">
      <h2 id="sfr-files" className="h-section">Files</h2>
      {q.isPending ? (
        <p className="muted mono">Loading files…</p>
      ) : q.isError ? (
        <p className="placeholder">Could not load the file list.</p>
      ) : (
        <>
          <ul className="sfr-files">
            {q.data.files.map((f) => (
              <li key={f.name}>
                <span>{f.name}</span>
                <span className="muted small">{f.kind === "sensors_xlsx" ? "Flight sensor data (Excel)" : f.kind === "tm_graphs_docx" ? "NASA telemetry graphs (Word)" : f.category}</span>
                <span className="mono small">{f.mb} MB</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            In NASA PSI (PSI-99, record of this sample). The sensor data shown on this page come from the Excel file above. PSI also holds{" "}
            {q.data.image_archives} camera image archives ({q.data.image_archives_gb} GB) for this sample; the site does not use them. Study-wide
            documents are in the <Link to={`${BASE}/library#documents`}>Library</Link>.
          </p>
        </>
      )}
    </section>
  );
}
