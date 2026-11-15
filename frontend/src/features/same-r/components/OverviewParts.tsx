// Overview sections in the FLEX order (.claude/skills/study-overview-page): test cards, findings, references.
import { useQueries } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { DETECTOR_LABELS, PTRAK_LIMIT, sameRSeriesQuery, type TimeSeries } from "@/features/same-r-3d";
import { num } from "@/shared/lib/format";
import { CopyButton } from "@/shared/ui/CopyButton";
import { TimeChart, type Series, type Tone } from "@/shared/ui/chart/TimeChart";
import { apiUrl, useSameRSeries } from "../api";
import { CARD_NOTES, FINDINGS, HOW, type Finding, type Note } from "../content";
import { LIBRARY_PATH, testHref } from "../lib/compare";
import type { Pick } from "../lib/picks";
import { column, fromRest, heaterOff, peak, type TestGroup } from "../lib/tests";
import { REFS } from "../refs";
import type { Overview, Row } from "../types";

// shortcut: a copy of study-overview's useNear (features expose only index.ts); move to shared/ if a third page needs it
/** True once the element is within `margin` of the viewport; stays true after that. */
function useNear<T extends Element>(margin = "300px") {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  return [ref, near] as const;
}

const hkpUrl = (n: number) => apiUrl(`/api/studies/same-r/tests/${n}/timeseries/hkp`);
const TONES: Tone[] = ["ink", "s1", "uv"];

function Wait({ text }: { text: string }) {
  return <p className="tc-wait mono small">{text}</p>;
}

function RefLinks({ ids }: { ids: string[] }) {
  return (
    <p className="tc-refs mono small">
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && <span className="muted"> · </span>}
          <a href={REFS[id].href} target="_blank" rel="noreferrer">
            {REFS[id].short}
          </a>
        </span>
      ))}
    </p>
  );
}

function Notes({ notes }: { notes: Note[] }) {
  return (
    <ul className="tc-notes">
      {notes.map((n) => (
        <li key={n.text}>
          <p>{n.text}</p>
          <RefLinks ids={n.refs} />
        </li>
      ))}
    </ul>
  );
}

/** One line of test conditions, from the tests table. */
function TestHead({ r }: { r: Row }) {
  return (
    <>
      <Link to={testHref(r.test_no)}>#{r.test_id}</Link> · {r.material ?? "material not recorded"} · Rt/R0 {r.heater_rt_r0 ?? "—"} · inlet{" "}
      {r.inlet_velocity_cm_s ?? "—"} cm/s{r.description ? ` · “${r.description}”` : ""}
    </>
  );
}

/** P-Trak count and DustTrak B mass of one test; at the P-Trak limit the points are drawn apart as lower bounds. */
function SmokeCharts({ s, n }: { s: TimeSeries; n: number }) {
  const off = heaterOff(s);
  const markers = off == null ? [] : [{ x: off, label: `heater off ${num(off, 0)} s` }];
  const count = column(s, "ptrak_per_cc");
  const atLimit = count.filter(([, v]) => v >= PTRAK_LIMIT);
  const countSeries: Series[] = [{ id: "c", label: "P-Trak count, measured", points: count.filter(([, v]) => v < PTRAK_LIMIT), kind: "dots" }];
  if (atLimit.length) countSeries.push({ id: "lim", label: "at the P-Trak limit: true count ≥ 500,000", points: atLimit, kind: "dots", tone: "s2" });
  const mass = column(s, "dusttrak_b_mg_m3");
  return (
    <>
      {count.length ? (
        <TimeChart series={countSeries} markers={markers} xLabel="time, s" yLabel="particles/cm³" height={200} ariaLabel={`P-Trak particle count of test ${n} against time`} />
      ) : (
        <p className="tc-cap mono small">This test has no P-Trak readings.</p>
      )}
      {mass.length ? (
        <TimeChart series={[{ id: "m", label: "DustTrak B smoke mass, measured", points: mass, kind: "dots", tone: "s1" }]} markers={markers} xLabel="time, s" yLabel="mg/m³" height={160} ariaLabel={`DustTrak B smoke mass of test ${n} against time`} />
      ) : (
        <p className="tc-cap mono small">This test has no DustTrak B readings.</p>
      )}
      {atLimit.length > 0 && (
        <p className="tc-cap mono small">
          {atLimit.length} s at the limit, first at {num(atLimit[0][0], 0)} s.
        </p>
      )}
    </>
  );
}

/** ISS light scatter and STS ionization, as change from the level before heating (derived). */
function DetectorChart({ s, n, active }: { s: TimeSeries; n: number; active: string[] }) {
  const cols = ["iss_scatter_v", "sts_v"].filter((c) => active.includes(c));
  const series: Series[] = cols.map((c, i) => ({ id: c, label: `${DETECTOR_LABELS[c]}, change (derived)`, points: fromRest(column(s, c)), kind: "dots", tone: TONES[i] }));
  const drawn = series.filter((x) => x.points.length);
  if (!drawn.length) return <p className="tc-cap mono small">No detector readings before heating in this test, so no change can be computed.</p>;
  const ys = drawn.flatMap((x) => x.points.map(([, y]) => y));
  const off = heaterOff(s);
  return (
    <>
      <TimeChart
        series={drawn}
        markers={off == null ? [] : [{ x: off, label: `heater off ${num(off, 0)} s` }]}
        yDomain={[Math.min(0, ...ys) * 1.05, Math.max(0, ...ys) * 1.05 || 0.1]}
        xLabel="time, s"
        yLabel="change from rest, V"
        height={230}
        ariaLabel={`Smoke detector signals of test ${n} against time, as change from the level before heating`}
      />
      <p className="tc-cap mono small">
        Largest change (derived):{" "}
        {drawn.map((x) => `${DETECTOR_LABELS[x.id]} ${num(peak(x.points)?.[1], 2, "V")}`).join(" · ")}
      </p>
    </>
  );
}

function TestCard({ p }: { p: Pick }) {
  const [ref, near] = useNear<HTMLElement>();
  const s = useSameRSeries(p.g.test_no, near);
  const r = p.g.main;
  let chart: React.ReactNode;
  if (!near || s.isPending) chart = <Wait text={near ? "Loading the series…" : "Chart loads here…"} />;
  else if (s.isError) chart = <p className="placeholder">Could not load the series ({s.error.message}).</p>;
  else if (!s.data) chart = <p className="tc-cap mono small">This test has no telemetry.</p>;
  else if (p.id === "sts") chart = <DetectorChart s={s.data} n={p.g.test_no} active={r.active_detectors ?? []} />;
  else chart = <SmokeCharts s={s.data} n={p.g.test_no} />;
  return (
    <article className="tc" ref={ref}>
      <div className="tc-left">
        <p className="tc-kicker mono small">{p.title}</p>
        <h3 className="tc-title">{p.why}</h3>
        <div className="tc-head mono small">
          <TestHead r={r} />
        </div>
        {chart}
      </div>
      <div className="tc-right">
        <h4 className="tc-sub mono small">What to know</h4>
        <Notes notes={CARD_NOTES[p.id] ?? []} />
      </div>
    </article>
  );
}

/** Tests to read first: each card is a test picked from the data, its chart and a few sourced notes. */
export function TestCards({ picks }: { picks: Pick[] }) {
  if (!picks.length) return null;
  return (
    <section className="band" aria-labelledby="sr-first">
      <div className="wrap">
        <h2 id="sr-first" className="h-section">Tests to read first</h2>
        <p className="lede">For each thing worth seeing, the first test with telemetry that shows it. Charts come from that test's series; the notes cite the source behind each point.</p>
        <div className="tc-list">
          {picks.map((p) => (
            <TestCard key={p.id} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** How it worked: steps with their sources. */
export function How({ photos }: { photos: React.ReactNode }) {
  return (
    <section className="band" aria-labelledby="sr-how">
      <div className="wrap">
        <h2 id="sr-how" className="h-section">How it worked</h2>
        <ol className="cells sr-how">
          {HOW.map((h, i) => (
            <li key={h.title} className="cell">
              <span className="mono small muted">{String(i + 1).padStart(2, "0")}</span>
              <h3>{h.title}</h3>
              <p>{h.text}</p>
              <RefLinks ids={h.refs} />
            </li>
          ))}
        </ol>
        <h3 className="sr-sub">The hardware on the ISS</h3>
        {photos}
      </div>
    </section>
  );
}

function FindingChart({ f, rows, data }: { f: Finding; rows: Map<number, Row>; data: (TimeSeries | null | undefined)[] }) {
  const label = (n: number) => `#${n} ${rows.get(n)?.material ?? ""}`.trim();
  const missing = f.tests.filter((_, i) => !data[i]);
  const per = f.tests.flatMap((n, i) => {
    const s = data[i];
    if (!s) return [];
    const pts = f.id === "scatter" ? fromRest(column(s, "iss_scatter_v")) : column(s, "dusttrak_b_mg_m3");
    return [{ n, i, pts, count: peak(column(s, "ptrak_per_cc")) }];
  });
  const series: Series[] = per.filter((x) => x.pts.length).map((x) => ({ id: String(x.n), label: label(x.n), points: x.pts, kind: "dots", tone: TONES[x.i % TONES.length] }));
  if (!series.length) return <p className="tc-cap mono small">None of these tests has this series.</p>;
  const scatter = f.id === "scatter";
  const ys = series.flatMap((x) => x.points.map(([, y]) => y));
  return (
    <>
      <TimeChart
        series={series}
        xLabel="time, s"
        yLabel={scatter ? "ISS scatter, change from rest, V" : "DustTrak B, mg/m³"}
        yDomain={scatter ? [Math.min(0, ...ys) * 1.05, Math.max(0, ...ys) * 1.05 || 0.1] : undefined}
        height={230}
        ariaLabel={scatter ? "ISS light-scattering detector signal against time for three baseline runs, as change from the level before heating" : "DustTrak B smoke mass against time for three baseline runs"}
      />
      <p className="tc-cap mono small">
        {per
          .map((x) => `${label(x.n)}: ${scatter ? `largest change ${num(peak(x.pts)?.[1], 2, "V")} (derived)` : `peak ${num(peak(x.pts)?.[1], 1, "mg/m³")} at ${num(peak(x.pts)?.[0], 0)} s`} · P-Trak peak ${num(x.count?.[1], 0, "/cm³")}${scatter ? "" : ` at ${num(x.count?.[0], 0)} s`}`)
          .join(" · ")}
      </p>
      {missing.length > 0 && <p className="tc-cap mono small">No telemetry for {missing.map((n) => `#${n}`).join(", ")}.</p>}
    </>
  );
}

function FindingCard({ f, rows }: { f: Finding; rows: Map<number, Row> }) {
  const [ref, near] = useNear<HTMLElement>();
  const qs = useQueries({ queries: f.tests.map((n) => ({ ...sameRSeriesQuery(n), enabled: near })) });
  const descs = [...new Set(f.tests.map((n) => rows.get(n)?.description).filter(Boolean))];
  const ready = near && qs.every((q) => !q.isPending);
  const failed = qs.find((q) => q.isError)?.error;
  return (
    <article className="tc" ref={ref}>
      <div className="tc-left">
        <p className="tc-kicker mono small">
          Finding · <span className={`tc-ev tc-ev-${f.evidence}`}>{f.evidence === "measured" ? "measured" : "derived from measurements"}</span>
        </p>
        <div className="tc-head mono small">
          {f.tests.map((n, i) => {
            const r = rows.get(n);
            return (
              <span key={n}>
                {i > 0 && " · "}
                <Link to={testHref(n)}>#{n}</Link> {r?.material ?? ""} Rt/R0 {r?.heater_rt_r0 ?? "—"}
              </span>
            );
          })}
        </div>
        {failed ? (
          <p className="placeholder">Could not load the series ({failed.message}).</p>
        ) : ready ? (
          <FindingChart f={f} rows={rows} data={qs.map((q) => q.data)} />
        ) : (
          <Wait text={near ? "Loading the series…" : "Chart loads here…"} />
        )}
      </div>
      <div className="tc-right">
        <p className="tc-claim">{f.claim}</p>
        {descs.length > 0 && (
          <blockquote className="ov-quote">
            {descs.map((d) => `“${d}”`).join(" ")}
            <cite className="mono">researchers' description in the tests table, tests {f.tests.map((n) => `#${n}`).join(", ")}</cite>
          </blockquote>
        )}
        <p className="tc-caveat small">
          <b className="mono">Keep in mind</b> {f.caveat}
        </p>
        <RefLinks ids={f.refs} />
        <p className="tc-refs mono small">
          {f.tests.map((n, i) => (
            <span key={n}>
              {i > 0 && <span className="muted"> · </span>}
              <Link to={testHref(n)}>open #{n}</Link> (<a href={hkpUrl(n)}>series, JSON</a>)
            </span>
          ))}
        </p>
      </div>
    </article>
  );
}

/** What was found: each result with the tests that show it, a chart, its caveat and its sources. */
export function Findings({ groups }: { groups: TestGroup[] }) {
  const rows = new Map(groups.map((g) => [g.test_no, g.main]));
  return (
    <section className="band" aria-labelledby="sr-found">
      <div className="wrap">
        <h2 id="sr-found" className="h-section">What was found</h2>
        <p className="lede">Results from the SAME-R reports, each shown on three baseline runs that had both the ISS and the Shuttle detector.</p>
        <div className="tc-list">
          {FINDINGS.map((f) => (
            <FindingCard key={f.id} f={f} rows={rows} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Ids in the order they first appear on the page: cards, how it worked, findings. */
function usedRefs(picks: Pick[]): string[] {
  const ids = [...picks.flatMap((p) => (CARD_NOTES[p.id] ?? []).flatMap((n) => n.refs)), ...HOW.flatMap((h) => h.refs), ...FINDINGS.flatMap((f) => f.refs)];
  return [...new Set(ids)].filter((id) => id !== "psi101");
}

/** References for everything cited above, then the dataset citation, the licence and the objective. */
export function References({ o, picks }: { o: Overview; picks: Pick[] }) {
  const citation = `${o.title} (${o.acronym}, ${o.accession}). NASA Physical Sciences Informatics.${o.doi ? ` https://doi.org/${o.doi}` : ""}`;
  return (
    <section className="band" aria-labelledby="sr-refs">
      <div className="wrap">
        <h2 id="sr-refs" className="h-section">References</h2>
        <ol className="ov-refs">
          {usedRefs(picks).map((id) => (
            <li key={id}>
              {REFS[id].full}{" "}
              <a className="mono small" href={REFS[id].href} target="_blank" rel="noreferrer">
                {REFS[id].href.replace("https://", "")}
              </a>
            </li>
          ))}
        </ol>
        <h3 className="ov-refs-sub mono small">Data</h3>
        <div className="sr-cite">
          <p className="mono small">{citation}</p>
          <CopyButton text={citation} />
        </div>
        <p className="small muted">
          License:{" "}
          <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">
            CC0 1.0
          </a>
          . Please cite the DOI. Reports, drawings and presentations are in the <Link to={LIBRARY_PATH}>Library</Link>.
        </p>
        <details>
          <summary>Objective and hypothesis</summary>
          <div className="body">
            <h3>Objective</h3>
            <p>{o.objective}</p>
            <h3>Hypothesis</h3>
            <p>{o.hypothesis}</p>
          </div>
        </details>
      </div>
    </section>
  );
}
