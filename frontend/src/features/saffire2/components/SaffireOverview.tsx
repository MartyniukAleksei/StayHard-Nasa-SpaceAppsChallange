import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { num } from "@/shared/lib/format";
import { TimeChart, type Series as ChartSeries } from "@/shared/ui/chart/TimeChart";
import { CopyButton } from "@/shared/ui/CopyButton";
import { useSaffireDashboard, useSaffireSeries } from "../api";
import { COMPARE_PRESETS, FINDINGS, glyphOf, HOW_IT_WORKED, QUESTIONS_INTRO, REFS, SHOWCASE_SAMPLE, VERDICT_LABEL, type Finding } from "../content";
import { BASE, compareHref, sampleHref, samplesHref } from "../lib/links";
import { maxAcross, points, toPpm } from "../lib/series";
import type { Dashboard, Sample } from "../types";
import { EarthVsSpaceChart, Hero, SignatureScatter, SpreadPlot } from "./Overview";
import { SAMPLE_TC, tcPair } from "./SampleCharts";
import "./saffire2.css";

/** Saffire-II overview in the production layout of FLEX: hero → 3D → samples to read first →
 *  how it worked → what was found → questions → browse → references. */
export function SaffireOverview({ replay }: { replay?: ReactNode }) {
  const { data, isPending, isError, error } = useSaffireDashboard();
  const { hash } = useLocation();
  useEffect(() => {
    if (data && hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [data, hash]);

  if (isPending) return <Loading />;
  if (isError) return <Failed message={error.message} />;
  return (
    <div className="sf">
      <Hero data={data} />
      <Example3D replay={replay} data={data} />
      <SamplesToRead data={data} />
      <HowItWorked data={data} />
      <Findings data={data} />
      <Questions data={data} />
      <Browse />
      <References data={data} />
    </div>
  );
}

export function Loading() {
  return (
    <div className="wrap band">
      <p className="muted mono">Loading Saffire-II…</p>
    </div>
  );
}

export function Failed({ message }: { message: string }) {
  return (
    <div className="wrap band">
      <p className="placeholder" role="alert">
        Could not load Saffire-II data ({message}). Is the backend running and the database built with data/saffire2?
      </p>
    </div>
  );
}

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

function Pending({ text }: { text: string }) {
  return <p className="sf-tc-wait mono small">{text}</p>;
}

function RefLinks({ ids }: { ids: string[] }) {
  return (
    <p className="sf-tc-refs mono small">
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && <span className="muted"> · </span>}
          {REFS[id].href.startsWith("/") ? <Link to={REFS[id].href}>{REFS[id].short}</Link> : <a href={REFS[id].href} target="_blank" rel="noreferrer">{REFS[id].short}</a>}
        </span>
      ))}
    </p>
  );
}

/** One line of sample conditions from the table, linked to the sample. */
function SampleHead({ s }: { s: Sample }) {
  return (
    <>
      <Link to={sampleHref(s.test_id)}>{s.test_id}</Link> · {glyphOf(s.material).glyph} {s.material} · {s.thickness_raw} · {s.flow_direction} ·
      µg {s.ug_burn_length_raw} · 1g {s.g1_burn_length_raw}
    </>
  );
}

/** G: the whole series as a 3D replay, loaded when the section comes near. */
function Example3D({ replay, data }: { replay?: ReactNode; data: Dashboard }) {
  const [ref, near] = useNear<HTMLDivElement>();
  if (!replay) return null;
  return (
    <section className="band" aria-labelledby="sf-ex-title">
      <div className="wrap sf-example">
        <h2 id="sf-ex-title" className="h-section">See the experiment in 3D</h2>
        <p className="lede">
          The flow duct aboard Cygnus with its card of nine strips, rebuilt from the flight data and the experiment table.
          Play the series: each strip is lit in turn.
        </p>
        <p className="sf-example-cap mono small">
          {materialGroups(data.samples).map((g, i) => (
            <span key={g.label}>
              {i > 0 && " · "}
              <span aria-hidden="true">{g.glyph}</span> {g.label} {g.ids.join(", ")}
            </span>
          ))}{" "}
          · {data.sample_length_cm} cm strips
        </p>
        <div ref={ref} className="sf-example-stage">
          {near ? replay : <div className="sf-example-wait mono small">3D replay loads here…</div>}
        </div>
        <div className="sf-example-actions">
          <Link className="btn-solid" to={`${sampleHref(SHOWCASE_SAMPLE)}#sfr-watch`}>
            One sample in 3D →
          </Link>
          <Link className="btn-solid" to={samplesHref()}>
            View all samples →
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Samples grouped by material glyph, in card order. */
function materialGroups(samples: Sample[]) {
  const groups: { glyph: string; label: string; ids: string[] }[] = [];
  for (const s of samples) {
    const m = glyphOf(s.material);
    const g = groups.find((x) => x.label === m.label);
    if (g) g.ids.push(s.test_id);
    else groups.push({ glyph: m.glyph, label: m.label, ids: [s.test_id] });
  }
  return groups;
}

type Note = { text: ReactNode; refs: string[] };

function Card({ kicker, title, s, chart, notes }: { kicker: string; title: string; s: Sample; chart: ReactNode; notes: Note[] }) {
  return (
    <article className="sf-tc">
      <div className="sf-tc-left">
        <p className="sf-tc-kicker mono small">{kicker}</p>
        <h3 className="sf-tc-title">{title}</h3>
        <div className="sf-tc-head mono small">
          <SampleHead s={s} />
        </div>
        {chart}
      </div>
      <div className="sf-tc-right">
        <h4 className="sf-tc-sub mono small">What to know</h4>
        <ul className="sf-tc-notes">
          {notes.map((n, i) => (
            <li key={i}>
              <p>{n.text}</p>
              <RefLinks ids={n.refs} />
            </li>
          ))}
        </ul>
        <p className="sf-tc-refs mono small">
          <Link to={sampleHref(s.test_id)}>open sample {s.test_id}</Link>
        </p>
      </div>
    </article>
  );
}

const IGN = { x: 0, label: "ignition" };

/** Sensor chart of one sample, loaded when the card comes near. */
function SeriesChart({ id, kind, burnEnd }: { id: string; kind: "pair" | "co2" | "radiometer"; burnEnd: number | null }) {
  const [ref, near] = useNear<HTMLDivElement>();
  const q = useSaffireSeries(id, near);
  const s = q.data;
  let body: ReactNode = <Pending text="Chart loads here…" />;
  if (s) {
    const markers = burnEnd ? [IGN, { x: burnEnd, label: `burn time ${burnEnd} s (table)` }] : [IGN];
    let series: ChartSeries[] = [];
    let yLabel = "";
    let cap = "";
    if (kind === "pair") {
      const [a, b] = tcPair(id);
      series = [
        { id: "a", label: `A ${SAMPLE_TC[a]}`, points: points(s.t, s.sample_tc[a]), kind: "line", tone: "ink" },
        { id: "b", label: `B ${SAMPLE_TC[b]}`, points: points(s.t, s.sample_tc[b]), kind: "line", tone: "s2" },
      ];
      yLabel = "°C";
      cap = "Two thermocouples on the strip, A nearer the igniter. Which channels sit on this strip is our inference (estimate).";
    } else if (kind === "co2") {
      series = [
        { id: "co2", label: "CO₂", points: points(s.t, s.co2_pct.map(toPpm)), tone: "ink" },
      ];
      yLabel = "ppm";
      cap = "Module CO₂ from the flight sensor, 1 reading per second.";
    } else {
      series = [{ id: "r", label: "radiation", points: points(s.t, maxAcross(s.radiometers)), kind: "line", tone: "ink" }];
      yLabel = "mW/cm²";
      cap = "Highest of the four radiometers, pre-ignition offset removed (derived).";
    }
    const ys = series.flatMap((x) => x.points.map((p) => p[1]));
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    body = (
      <>
        <TimeChart series={series} markers={markers} xLabel="s from ignition" yLabel={yLabel} height={230} yDomain={kind === "co2" ? [lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1] : undefined} ariaLabel={`${yLabel} over time, sample ${id}`} />
        <p className="sf-tc-cap mono small">{cap}</p>
      </>
    );
  }
  return <div ref={ref}>{body}</div>;
}

/** «Samples to read first»: three strips that show the three outcomes. */
function SamplesToRead({ data }: { data: Dashboard }) {
  const by = (id: string) => data.samples.find((s) => s.test_id === id);
  const sibal = by("2-5");
  const pmma = by("2-8");
  const silicone = by("2-1");
  const maxRise = Math.max(...data.samples.map((s) => s.sensors?.co2_rise_pct ?? 0));
  return (
    <section className="band" aria-labelledby="sf-read">
      <div className="wrap">
        <h2 id="sf-read" className="h-section">Samples to read first</h2>
        <p className="lede">Three strips, three outcomes: one burned through, one smouldered at its base, one never kept burning.</p>
        <div className="sf-tc-list">
          {sibal && (
            <Card
              kicker="Full-length burn"
              title="The fabric burned the whole strip"
              s={sibal}
              chart={<SeriesChart id="2-5" kind="pair" burnEnd={sibal.burn_time_s} />}
              notes={[
                { text: <>The flame spread at {sibal.ug_spread.lo} mm/s and covered all {sibal.ug_burn_cm} cm in {sibal.burn_time_s} s.</>, refs: ["table"] },
                { text: <>Thermocouple A heated first and B later: the front passed one, then the other, peaking at {num(sibal.sensors?.peak_sample_t_c, 0, "°C")}.</>, refs: ["psi99"] },
                { text: <>On Earth the same fabric also burned completely and accelerated, so for this material the 1g test is not stricter.</>, refs: ["table", "urban19"] },
              ]}
            />
          )}
          {pmma && (
            <Card
              kicker="Flame held at the base"
              title="Thick plastic smouldered for minutes"
              s={pmma}
              chart={<SeriesChart id="2-8" kind="co2" burnEnd={pmma.burn_time_s} />}
              notes={[
                { text: <>The flame stayed anchored at the base for {pmma.burn_time_s} s and damaged about {pmma.ug_burn_cm} cm of the strip (Notes 3–4).</>, refs: ["table"] },
                {
                  text: (
                    <>
                      The strip thermocouples peaked at only {num(pmma.sensors?.peak_sample_t_c, 0, "°C")}, yet CO₂ rose by{" "}
                      {Math.round((pmma.sensors?.co2_rise_pct ?? 0) * 10000)} ppm
                      {pmma.sensors?.co2_rise_pct != null && pmma.sensors.co2_rise_pct >= maxRise * 0.9 ? ", among the largest of the nine" : ""}.
                    </>
                  ),
                  refs: ["psi99"],
                },
                { text: <>In the 1g upward test thick PMMA burned completely, accelerating.</>, refs: ["table", "thomsen19"] },
              ]}
            />
          )}
          {silicone && (
            <Card
              kicker="No sustained flame"
              title="Silicone did not keep burning"
              s={silicone}
              chart={<SeriesChart id="2-1" kind="radiometer" burnEnd={null} />}
              notes={[
                { text: <>The igniter ran for {num(silicone.sensors?.igniter_on_s, 1, "s")}; radiation rose only while it was on, and the burned length is ~0.</>, refs: ["table", "psi99"] },
                { text: <>On Earth the same silicone burned completely, accelerating: here the 1g test was far stricter.</>, refs: ["table", "niehaus"] },
              ]}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/** Schematic of the flow duct and the card. Not to scale; only names the parts used on this page. */
function Scheme() {
  const strips = Array.from({ length: 9 }, (_, i) => ({ n: i + 1, x: 120 + (i % 3) * 60, y: 52 + Math.floor(i / 3) * 62 }));
  return (
    <figure className="sf-hw-fig">
      <svg viewBox="0 0 400 260" role="img" aria-label="Schematic: flow duct with fans at the top, flow straighteners at the bottom and a card of nine sample strips in the middle; air flows upward">
        <rect x="80" y="6" width="240" height="248" className="sf-hw-duct" />
        <line x1="96" y1="22" x2="304" y2="22" className="sf-hw-fan" />
        <line x1="96" y1="238" x2="304" y2="238" className="sf-hw-grid" />
        {strips.map((s) => (
          <g key={s.n}>
            <rect x={s.x} y={s.y} width="14" height="46" className="sf-hw-strip" />
            <circle cx={s.x + 7} cy={s.n === 4 ? s.y - 4 : s.y + 50} r="2.5" className="sf-hw-ign" />
            <text x={s.x - 6} y={s.y + 27} textAnchor="end" className="sf-hw-lab sf-hw-muted">{s.n}</text>
          </g>
        ))}
        {[60, 340].map((x) => (
          <g key={x}>
            <line x1={x} y1="220" x2={x} y2="40" className="sf-hw-flow" />
            <path d={`M${x - 5},48 L${x},38 L${x + 5},48`} className="sf-hw-flow" />
          </g>
        ))}
        <text x="200" y="16" textAnchor="middle" className="sf-hw-lab sf-hw-muted">fans</text>
        <text x="200" y="252" textAnchor="middle" className="sf-hw-lab sf-hw-muted">flow straighteners</text>
        <text x="20" y="134" className="sf-hw-lab sf-hw-flowlab">air</text>
        <text x="380" y="134" textAnchor="end" className="sf-hw-lab sf-hw-flowlab">air</text>
      </svg>
      <figcaption className="mono small">Schematic, not to scale. Nine 5 × 29 cm strips (Readme Fig. 1); dots mark the igniters, at the upstream end except strip 4.</figcaption>
    </figure>
  );
}

/** B: how it worked: scheme, steps, and how many strips ended each way (from the table). */
function HowItWorked({ data }: { data: Dashboard }) {
  const full = data.sample_length_cm;
  const groups = [
    { key: "full", label: "Burned the full length", def: "the flame reached the far end of the strip", n: data.samples.filter((s) => (s.ug_burn_cm ?? 0) >= full).length },
    { key: "part", label: "Burned part of it", def: "a flame or visible damage on part of the strip", n: data.samples.filter((s) => (s.ug_burn_cm ?? 0) > 0 && (s.ug_burn_cm ?? 0) < full).length },
    { key: "none", label: "Did not keep burning", def: "no sustained flame once the igniter was off", n: data.samples.filter((s) => (s.ug_burn_cm ?? 0) <= 0).length },
  ];
  const total = data.samples.length;
  return (
    <section className="band" aria-labelledby="sf-how">
      <div className="wrap">
        <h2 id="sf-how" className="h-section">How it worked</h2>
        <div className="sf-hw">
          <Scheme />
          <ol className="sf-steps">
            {HOW_IT_WORKED.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <h3 className="sf-hw-sub mono small">How a strip ends in microgravity</h3>
        <ul className="sf-hw-ends">
          {groups.map((g) => (
            <li key={g.key} className="sf-hw-end">
              <span className="mono small">{g.label}</span>
              <p className="sf-hw-count">
                {g.n}
                <span className="mono small muted"> of {total} strips</span>
              </p>
              <p className="small muted">{g.def}</p>
              <div className={`sf-hw-bar sf-hw-bar-${g.key}`} aria-hidden="true">
                <i style={{ width: `${(g.n / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="small muted sf-hw-note">Burned length as reported in the experiment table.</p>
      </div>
    </section>
  );
}

function FindingChart({ f, data }: { f: Finding; data: Dashboard }) {
  if (f.id === "earth") return <EarthVsSpaceChart data={data} ids={["2-1", "2-2", "2-3", "2-4"]} />;
  if (f.id === "fabric") return <SpreadPlot data={data} />;
  if (f.id === "pmma") return <SignatureScatter data={data} />;
  return <EarthVsSpaceChart data={data} ids={["2-7"]} />;
}

/** D: what was found: each finding with its samples, a chart, its caveat and its sources. */
function Findings({ data }: { data: Dashboard }) {
  return (
    <section className="band" aria-labelledby="sf-found">
      <div className="wrap">
        <h2 id="sf-found" className="h-section">What was found</h2>
        <p className="lede">Four results from the flight, each with the strips that show it.</p>
        <div className="sf-tc-list">
          {FINDINGS.map((f) => (
            <article key={f.id} className="sf-tc">
              <div className="sf-tc-left">
                <p className="sf-tc-kicker mono small">
                  Finding · <span className={`sf-tc-ev sf-tc-ev-${f.evidence}`}>{f.evidence === "measured" ? "from the table" : "derived from measurements"}</span>
                </p>
                <div className="sf-tc-head sf-tc-heads mono small">
                  {f.samples.map((id) => {
                    const s = data.samples.find((x) => x.test_id === id);
                    return <p key={id}>{s ? <SampleHead s={s} /> : <Link to={sampleHref(id)}>{id}</Link>}</p>;
                  })}
                </div>
                <FindingChart f={f} data={data} />
              </div>
              <div className="sf-tc-right">
                <p className="sf-tc-claim">{f.claim}</p>
                <p className="sf-tc-caveat small">
                  <b className="mono">Keep in mind</b> {f.caveat}
                </p>
                <RefLinks ids={f.refs} />
                {f.samples.length > 1 && (
                  <p className="sf-tc-refs mono small">
                    <Link to={compareHref(f.samples)}>compare {f.samples.join(" and ")}</Link>
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Preset questions in the FLEX preset grid: a count, how the samples ended against 1g, and a link that opens them. */
function Questions({ data }: { data: Dashboard }) {
  const byId = new Map(data.samples.map((s) => [s.test_id, s]));
  return (
    <section className="band" aria-labelledby="sf-q">
      <div className="wrap">
        <h2 id="sf-q" className="h-section">Questions to explore</h2>
        <p className="lede">{QUESTIONS_INTRO}</p>
        <p className="sf-soon mono">Verdicts compare the burned length in microgravity with the 1g upward test (derived).</p>
        <ul className="cells sf-presets" role="list">
          {COMPARE_PRESETS.map((p) => {
            const samples = p.ids.map((id) => byId.get(id)).filter((s): s is Sample => !!s);
            const counts = new Map<string, number>();
            for (const s of samples) counts.set(VERDICT_LABEL[s.verdict], (counts.get(VERDICT_LABEL[s.verdict]) ?? 0) + 1);
            return (
              <li key={p.id} className="cell sf-preset">
                <h3>{p.title}</h3>
                <Link className="sf-group" to={compareHref(p.ids)}>
                  <div className="stat">
                    <b>{samples.length}</b>
                    <span>samples · {samples.map((s) => `${glyphOf(s.material).glyph} ${s.test_id}`).join("  ")}</span>
                  </div>
                  <p className="small muted">{p.question}</p>
                  <div className="sf-verdicts mono small">
                    {[...counts].map(([label, n]) => (
                      <span key={label}>
                        <b>{n}</b> {label}
                      </span>
                    ))}
                  </div>
                  <span className="sf-open mono small">compare samples →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Browse() {
  return (
    <section className="band" aria-label="All samples">
      <div className="wrap sf-browse">
        <p className="lede">Every sample, filterable by material, flow direction and outcome.</p>
        <Link className="btn" to={samplesHref()}>
          Browse all samples →
        </Link>
      </div>
    </section>
  );
}

/** References for everything cited above, the dataset citation, licence and passport. */
function References({ data }: { data: Dashboard }) {
  const { about } = data;
  const ids = [...new Set(FINDINGS.flatMap((f) => f.refs).concat(["readme", "objectives", "urban19", "thomsen19", "niehaus"]))].filter((id) => id !== "psi99");
  const withDoi = about.publications.filter((p) => p.doi).length;
  return (
    <section className="band" aria-labelledby="sf-refs">
      <div className="wrap">
        <h2 id="sf-refs" className="h-section">References</h2>
        <ol className="sf-refs">
          {ids.map((id) => (
            <li key={id}>
              {REFS[id].full}{" "}
              {REFS[id].href.startsWith("/") ? (
                <Link className="mono small" to={REFS[id].href}>
                  in the Library
                </Link>
              ) : (
                <a className="mono small" href={REFS[id].href} target="_blank" rel="noreferrer">
                  {REFS[id].href.replace("https://", "")}
                </a>
              )}
            </li>
          ))}
        </ol>
        <h3 className="sf-refs-sub mono small">Data</h3>
        <div className="sf-cite-row">
          <p className="mono small">{about.citation}</p>
          <CopyButton text={about.citation} />
        </div>
        <p className="small muted">
          License:{" "}
          <a href={about.license_link} target="_blank" rel="noreferrer">
            {about.license_name}
          </a>
          . {about.publications.length} related publications ({withDoi} with a DOI) and the limitations of the data in the{" "}
          <Link to={`${BASE}/library`}>Library</Link>.
        </p>
        <details>
          <summary>Objective, hypothesis and team</summary>
          <div className="body">
            <h3>Objective</h3>
            <p>{about.objective}</p>
            <h3>Hypothesis</h3>
            <p>{about.hypothesis}</p>
            <h3>Hardware</h3>
            <p>
              {about.hardware} · {about.flight_program}
            </p>
            <h3>Team</h3>
            <ul className="sf-team">
              {about.contacts.map((c) => (
                <li key={c.name}>
                  {c.name} <span className="muted">· {c.affiliation}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </section>
  );
}
