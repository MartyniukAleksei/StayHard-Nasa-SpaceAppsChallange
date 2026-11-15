import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Bass2Apparatus3D } from "@/features/bass2-apparatus-3d";
import { CopyButton } from "@/shared/ui/CopyButton";
import { TimeChart, type Series } from "@/shared/ui/chart/TimeChart";
import { testHref, useBass2Overview, useBass2Test, useBass2Tests } from "../api";
import { FINDINGS, HERO_LEDE, HERO_QUESTION, HOW_IT_WORKED, PRESETS, TEAMS, U_MAP_TEXT, U_MAP_TITLE, type FindingCopy } from "../content";
import { firstNumber, OUTCOME_ORDER, OUTCOMES } from "../lib/outcomes";
import { coVsCo2, flameOutAt, numbers, o2VsCo2, seriesColumn, slopeThroughOrigin, zeroFlowAt, type Pt } from "../lib/series";
import { REFS } from "../refs";
import { CARDS, type Card, type Note } from "../testCards";
import type { Finding, Overview, TestRow } from "../types";
import { OutcomeMark } from "./Glyph";
import { OxygenStrip, type RefLine } from "./OxygenStrip";
import "./bass2.css";

/** BASS-II overview, same order as the FLEX page (.claude/skills/study-overview-page). */
export function Bass2Overview() {
  const ov = useBass2Overview();
  const tests = useBass2Tests();

  if (ov.isPending) {
    return (
      <div className="wrap band">
        <p className="muted mono">Loading BASS-II…</p>
      </div>
    );
  }
  if (ov.isError) {
    return (
      <div className="wrap band">
        <p className="placeholder" role="alert">
          Could not load BASS-II data ({ov.error.message}). Is the backend running and the database built with the bass2
          snapshot?
        </p>
      </div>
    );
  }
  const d = ov.data;
  return (
    <div className="b2">
      <Hero ov={d} />
      <section className="band" aria-labelledby="b2-3d-title">
        <div className="wrap">
          <h2 id="b2-3d-title" className="h-section">Inside the flow duct</h2>
          <p className="lede">
            <span className="tag">simulation, not a measurement</span> A schematic of the BASS-II wind tunnel: pick a
            sample, move the flow and oxygen, and see which way the flame goes; or replay a real test, with the flow and the
            flame read from its NASA video (estimate). Shapes are schematic; the limits come from the report. Data:{" "}
            <a href={`https://doi.org/${d.doi}`} target="_blank" rel="noreferrer">
              doi:{d.doi}
            </a>
            .
          </p>
          <Bass2Apparatus3D />
        </div>
      </section>
      <TestCards />
      <HowItWorked tests={tests.data} />
      <Findings findings={d.findings} tests={tests.data} />
      <Presets />
      <section className="band" aria-label="All tests">
        <div className="wrap b2-browse">
          <p className="lede">Every burn, filterable by team, sample, flow geometry and outcome.</p>
          <Link className="btn" to="/studies/bass2/tests">
            Browse all tests →
          </Link>
        </div>
      </section>
      <References ov={d} />
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function Hero({ ov }: { ov: Overview }) {
  const f = ov.facts;
  return (
    <section className="band" aria-labelledby="b2-hero-title">
      <div className="wrap b2-hero">
        <p className="b2-kicker mono">
          {ov.acronym} · {ov.title} · ISS
        </p>
        <h1 id="b2-hero-title" className="h-display">{HERO_QUESTION}</h1>
        <p className="lede">{HERO_LEDE}</p>
        <div className="stats">
          <Stat value={f.n_tests} label="burns on the ISS" />
          <Stat value={f.by_material.length} label="sample materials" />
          <Stat value={f.n_pi} label="research teams" />
          <Stat value={`${f.o2_min_pct}–${f.o2_max_pct}%`} label="oxygen at ignition" />
        </div>
        <div className="b2-cta">
          <Link className="btn" to="/studies/bass2/tests">
            Browse all tests →
          </Link>
        </div>
        <p className="b2-meta mono small">
          {ov.acronym} · {ov.accession} · {ov.hardware} · {f.first_year}–{f.last_year} ·{" "}
          <a href={`https://doi.org/${ov.doi}`} target="_blank" rel="noreferrer">
            doi:{ov.doi}
          </a>
        </p>
      </div>
    </section>
  );
}

/* ---------- shared card parts ---------- */

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

function RefLinks({ ids }: { ids: string[] }) {
  return (
    <p className="b2c-refs mono small">
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
    <ul className="b2c-notes">
      {notes.map((n) => (
        <li key={n.text}>
          <p>{n.text}</p>
          <RefLinks ids={n.refs} />
        </li>
      ))}
    </ul>
  );
}

const Wait = ({ text }: { text: string }) => <p className="b2c-wait mono small">{text}</p>;

/* ---------- tests to read first ---------- */

function TestCards() {
  return (
    <section className="band" aria-labelledby="b2-cards-title">
      <div className="wrap">
        <h2 id="b2-cards-title" className="h-section">Tests to read first</h2>
        <p className="lede">
          Three burns, each with its timeline read from the NASA video: the air speed the crew set and how bright the
          flame was in the picture.
        </p>
        <div className="b2c-list">
          {CARDS.map((c) => (
            <TestCard key={c.test} c={c} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TestCard({ c }: { c: Card }) {
  const [ref, near] = useNear<HTMLElement>();
  const q = useBass2Test(c.test);
  const d = near ? q.data : undefined;
  const air = useMemo(() => seriesColumn(d?.video_series, "air_cm_s"), [d]);
  const scene = useMemo(() => seriesColumn(d?.video_series, "scene_px"), [d]);
  const zero = useMemo(() => zeroFlowAt(air), [air]);
  const out = useMemo(() => flameOutAt(scene), [scene]);
  const t = d?.test;
  const markers = zero != null ? [{ x: zero, label: "air reads 0" }] : [];
  return (
    <article className="b2c" ref={ref}>
      <div className="b2c-left">
        <p className="b2c-kicker mono small">{c.phenomenon}</p>
        <h3 className="b2c-title">{c.title}</h3>
        <div className="b2c-head mono small">
          <Link to={testHref(c.test)}>{c.test}</Link>
          {t && (
            <>
              {" "}· {t.material} · {t.o2_initial_pct ?? "—"}% O₂ at ignition · {t.flow_config ?? "flow n/a"} flow ·{" "}
              <OutcomeMark outcome={t.outcome} />
            </>
          )}
        </div>
        {!near || q.isPending ? (
          <Wait text="Chart loads here…" />
        ) : !d?.video_series ? (
          <Wait text="No timeline was read from this test's video." />
        ) : (
          <>
            <TimeChart
              series={[{ id: "air", label: "air speed shown on the video, cm/s", points: air, kind: "dots", tone: "ink" }]}
              markers={markers}
              xLabel="video time, s"
              yLabel="cm/s"
              height={170}
              ariaLabel={`Air speed reading of test ${c.test} against video time`}
            />
            <TimeChart
              series={[
                {
                  id: "scene",
                  label: "bright pixels in the video, log₁₀ (flame visibility)",
                  points: scene.map(([x, v]) => [x, Math.log10(v + 1)] as Pt),
                  kind: "dots",
                  tone: "uv",
                },
              ]}
              markers={out != null ? [{ x: out, label: "flame fades" }] : []}
              xLabel="video time, s"
              yLabel="log₁₀ px"
              height={150}
              ariaLabel={`Flame visibility in the video of test ${c.test} against time`}
            />
            <p className="b2c-cap mono small">
              <span className="tag">estimate</span> Read by us from the overlay of the NASA video (1 point per second).
              {zero != null ? ` The air reading reaches 0 at ${zero} s.` : " The air reading never reaches 0."}
              {out != null ? ` The flame fades into the background at about ${out} s.` : " No clear fade-out in the record."}{" "}
              <Link to={testHref(c.test)}>Watch the video with the timeline →</Link>
            </p>
          </>
        )}
      </div>
      <div className="b2c-right">
        <h4 className="b2c-sub mono small">What to know</h4>
        <Notes notes={c.notes} />
      </div>
    </article>
  );
}

/* ---------- how it worked ---------- */

function DuctScheme() {
  return (
    <figure className="b2h-fig">
      <svg
        viewBox="0 0 420 220"
        role="img"
        aria-label="Schematic of the BASS-II flow duct: fan, flow straightener, sample in the test section, exhaust screen, cameras"
      >
        <defs>
          <marker id="b2h-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" className="b2h-arrhead" />
          </marker>
        </defs>
        <rect x="40" y="70" width="340" height="90" className="b2h-duct" />
        <rect x="46" y="78" width="28" height="74" className="b2h-part" />
        <text x="60" y="176" textAnchor="middle" className="b2h-lab b2h-muted">fan</text>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1={92 + i * 5} x2={92 + i * 5} y1="78" y2="152" className="b2h-hc" />
        ))}
        <text x="110" y="176" textAnchor="middle" className="b2h-lab b2h-muted">honeycomb</text>
        <line x1="200" x2="300" y1="115" y2="115" className="b2h-sample" />
        <path d="M300 115 q 14 -10 22 0 q -8 10 -22 0" className="b2h-flame" />
        <text x="250" y="104" textAnchor="middle" className="b2h-lab">sample</text>
        <line x1="352" x2="352" y1="78" y2="152" className="b2h-exit" />
        <text x="352" y="176" textAnchor="middle" className="b2h-lab b2h-muted">exit screen</text>
        <path d="M130 50 L180 50" className="b2h-arrow" markerEnd="url(#b2h-arr)" />
        <text x="190" y="54" className="b2h-lab b2h-muted">flow, 0 to ~55 cm/s</text>
        <rect x="236" y="14" width="30" height="18" className="b2h-part" />
        <text x="276" y="27" className="b2h-lab b2h-muted">still camera, top</text>
        <rect x="200" y="186" width="30" height="16" className="b2h-part" />
        <text x="240" y="198" className="b2h-lab b2h-muted">video camera via mirror</text>
      </svg>
      <figcaption className="mono small">
        Schematic, not to scale. 7.6 × 7.6 × 17 cm duct; parts and flow range: NASA/TM-20210011385, p. 4–5, 64.
      </figcaption>
    </figure>
  );
}

function HowItWorked({ tests }: { tests: TestRow[] | undefined }) {
  const logged = (tests ?? []).filter((t) => t.in_report_log);
  const total = logged.length;
  const counts = OUTCOME_ORDER.map((k) => [k, logged.filter((t) => (t.outcome ?? "unknown") === k).length] as const);
  return (
    <section className="band" aria-labelledby="b2-how-title">
      <div className="wrap">
        <h2 id="b2-how-title" className="h-section">How it worked</h2>
        <div className="b2h">
          <DuctScheme />
          <ol className="b2h-steps">
            {HOW_IT_WORKED.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <h3 className="b2h-sub mono small">{U_MAP_TITLE}</h3>
        <div className="b2-narrow">
          {U_MAP_TEXT.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <RefLinks ids={["olson17", "report"]} />
        </div>
        <h3 className="b2h-sub mono small">Six teams, one wind tunnel</h3>
        <ul className="cells b2-teams">
          {TEAMS.map((tm) => (
            <li key={tm.pi} className="cell">
              <p className="mono small muted">
                {tm.letter} · {tm.pi} · {tm.affiliation}
              </p>
              <h4>{tm.sample}</h4>
              <p className="small muted">{tm.geometry}</p>
              <p className="small">{tm.takeaway}</p>
              <p className="mono small">
                <Link to={`/studies/bass2/tests?pi=${encodeURIComponent(tm.pi)}`}>
                  {tests ? tests.filter((x) => x.pi === tm.pi).length : "—"} tests →
                </Link>{" "}
                <span className="muted">· report p. {tm.page}</span>
              </p>
            </li>
          ))}
        </ul>
        <h3 className="b2h-sub mono small">
          How a test ends <span className="tag">derived</span>
        </h3>
        {tests && (
          <p className="small muted">
            {total} of {tests.length} tests are in the researchers' log (Appendix A of the report); the other{" "}
            {tests.length - total} have no recorded outcome and are not counted.
          </p>
        )}
        <ul className="b2h-ends">
          {counts
            .filter(([, n]) => n > 0)
            .map(([k, n]) => (
              <li key={k} className="b2h-end">
                <OutcomeMark outcome={k} />
                <p className="b2h-count">
                  {n}
                  <span className="mono small muted"> of {total}</span>
                </p>
                <p className="small muted">{OUTCOMES[k].label}</p>
                <div className={`b2h-bar b2-${OUTCOMES[k].tone}`} aria-hidden="true">
                  <i style={{ width: `${(n / total) * 100}%` }} />
                </div>
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- what was found ---------- */

type Group = "rods_conc" | "slabs" | "other";
const geometry = (t: TestRow): Group =>
  t.material_class === "pmma_rod" && (t.flow_config === "Concurrent" || t.flow_config === "Stagnation")
    ? "rods_conc"
    : t.material_class === "pmma_slab"
      ? "slabs"
      : "other";

function Evidence({ kind }: { kind: FindingCopy["evidence"] }) {
  return <span className={`b2-ev b2-ev-${kind}`}>{kind === "measured" ? "measured" : "derived from measurements"}</span>;
}

function ChartEarthSpace({ tests, findings }: { tests: TestRow[]; findings: Finding[] }) {
  const space = findings.find((f) => f.id === "rod_min_o2");
  const refs: RefLine[] = [];
  const s = firstNumber(space?.value);
  const e = firstNumber(space?.earth_value);
  if (s != null) refs.push({ x: s, label: `${s}% lowest O₂ for rods in space (p. ${space?.page})`, tone: "flame" });
  if (e != null) refs.push({ x: e, label: `${e}% Earth upward-spread limit (p. ${space?.page})`, tone: "ash" });
  return <OxygenStrip tests={tests} refs={refs} />;
}

function ChartCo({ tests, findings }: { tests: TestRow[]; findings: Finding[] }) {
  const pts: Record<Group, Pt[]> = { rods_conc: [], slabs: [], other: [] };
  for (const t of tests) {
    const p = coVsCo2(t);
    if (p) pts[geometry(t)].push(p);
  }
  const kRod = slopeThroughOrigin(pts.rods_conc);
  const kSlab = slopeThroughOrigin(pts.slabs);
  const xmax = Math.max(...[...pts.rods_conc, ...pts.slabs, ...pts.other].map(([x]) => x), 0.1);
  const rep = numbers(findings.find((f) => f.id === "co_per_co2")?.value).filter((n) => n > 10);
  const series: Series[] = [
    { id: "rods", label: `PMMA rods, flame with the flow (${pts.rods_conc.length} burns)`, points: pts.rods_conc, kind: "dots", tone: "ink" },
    { id: "slabs", label: `PMMA slabs, flame against the flow (${pts.slabs.length})`, points: pts.slabs, kind: "dots", tone: "uv" },
    { id: "other", label: `other samples (${pts.other.length})`, points: pts.other, kind: "dots", tone: "s2" },
  ];
  if (kRod != null)
    series.push({ id: "fr", label: `our fit, rods: ${Math.round(kRod)} ppm CO per 1% CO₂ (estimate)`, points: [[0, 0], [xmax, kRod * xmax]], kind: "dashed", tone: "flame" });
  if (kSlab != null)
    series.push({ id: "fs", label: `our fit, slabs: ${Math.round(kSlab)} ppm CO per 1% CO₂ (estimate)`, points: [[0, 0], [xmax, kSlab * xmax]], kind: "dashed", tone: "uv" });
  return (
    <>
      <TimeChart
        series={series}
        xLabel="CO₂ produced in the burn, % vol"
        yLabel="CO produced, ppm"
        xDomain={[0, xmax]}
        height={240}
        ariaLabel="Carbon monoxide produced against carbon dioxide produced in each BASS-II burn, by sample geometry"
      />
      {rep.length >= 2 && (
        <p className="b2c-cap mono small">
          Report averages (p. 7, Fig. 1.4): ~{rep[0]} ppm for rods with the flow, ~{rep[1]} ppm for slabs against it.
        </p>
      )}
    </>
  );
}

function ChartO2({ tests }: { tests: TestRow[] }) {
  const pts = tests.map(o2VsCo2).filter((p): p is Pt => p != null);
  const k = slopeThroughOrigin(pts);
  const xmax = Math.max(...pts.map(([x]) => x), 0.1);
  const series: Series[] = [
    { id: "o2", label: `one burn (${pts.length})`, points: pts, kind: "dots", tone: "ink" },
    { id: "stoich", label: "PMMA chemistry: 6 O₂ per 5 CO₂ (slope 1.2)", points: [[0, 0], [xmax, 1.2 * xmax]], kind: "line", tone: "s1" },
  ];
  if (k != null) series.push({ id: "fit", label: `our fit: slope ${k.toFixed(2)} (estimate)`, points: [[0, 0], [xmax, k * xmax]], kind: "dashed", tone: "flame" });
  return (
    <TimeChart
      series={series}
      xLabel="CO₂ produced, % vol"
      yLabel="O₂ consumed, % vol"
      xDomain={[0, xmax]}
      height={240}
      ariaLabel="Oxygen consumed against carbon dioxide produced in each BASS-II burn, with the PMMA stoichiometric line"
    />
  );
}

function FindingCard({ f, tests, findings }: { f: FindingCopy; tests: TestRow[] | undefined; findings: Finding[] }) {
  const [ref, near] = useNear<HTMLElement>();
  const quote = findings.find((x) => x.id === (f.id === "earth_vs_space" ? "rod_min_o2" : f.id === "stoichiometry" ? "o2_co2_stoich" : f.id));
  return (
    <article className="b2c" ref={ref}>
      <div className="b2c-left">
        <p className="b2c-kicker mono small">
          Finding · <Evidence kind={f.evidence} />
        </p>
        {!near || !tests ? (
          <Wait text="Chart loads here…" />
        ) : f.id === "earth_vs_space" ? (
          <ChartEarthSpace tests={tests} findings={findings} />
        ) : f.id === "co_per_co2" ? (
          <ChartCo tests={tests} findings={findings} />
        ) : (
          <ChartO2 tests={tests} />
        )}
      </div>
      <div className="b2c-right">
        <p className="b2c-claim">{f.claim}</p>
        {quote && (
          <blockquote className="b2-quote">
            “{quote.text}”
            <cite className="mono">
              NASA/TM-20210011385, p. {quote.page}
              {quote.figure ? `, ${quote.figure}` : ""}
            </cite>
          </blockquote>
        )}
        <p className="b2c-caveat small">
          <b className="mono">Keep in mind</b> {f.caveat}
        </p>
        <RefLinks ids={f.refs} />
        <p className="b2c-refs mono small">
          <Link to="/studies/bass2/tests">open the tests</Link>
        </p>
      </div>
    </article>
  );
}

function Findings({ findings, tests }: { findings: Finding[]; tests: TestRow[] | undefined }) {
  return (
    <section className="band" aria-labelledby="b2-found-title">
      <div className="wrap">
        <h2 id="b2-found-title" className="h-section">What was found</h2>
        <p className="lede">Three results from the BASS-II report, each drawn again from the test table on this site.</p>
        <div className="b2c-list">
          {FINDINGS.map((f) => (
            <FindingCard key={f.id} f={f} tests={tests} findings={findings} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- presets and references ---------- */

function Presets() {
  return (
    <section className="band" aria-labelledby="b2-presets-title">
      <div className="wrap">
        <h2 id="b2-presets-title" className="h-section">Ask the data</h2>
        <ul className="b2-presets">
          {PRESETS.map((p) => (
            <li key={p.params}>
              <Link to={`/studies/bass2/tests?${p.params}`}>{p.question} →</Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Ids in the order they first appear on the page: cards, How it worked, findings. */
function usedRefs(): string[] {
  const ids = CARDS.flatMap((c) => c.notes.flatMap((n) => n.refs)).concat(["olson17", "report"], FINDINGS.flatMap((f) => f.refs));
  return [...new Set(ids)].filter((id) => id !== "psi25");
}

function References({ ov }: { ov: Overview }) {
  return (
    <section className="band" aria-labelledby="b2-refs-title">
      <div className="wrap">
        <h2 id="b2-refs-title" className="h-section">References</h2>
        <ol className="b2-refs">
          {usedRefs().map((id) => (
            <li key={id}>
              {REFS[id].full}{" "}
              <a className="mono small" href={REFS[id].href} target="_blank" rel="noreferrer">
                {REFS[id].href.replace("https://", "")}
              </a>
            </li>
          ))}
        </ol>
        <h3 className="b2h-sub mono small">Data</h3>
        <div className="b2-cite">
          <p className="mono small">{ov.citation}</p>
          <CopyButton text={ov.citation} />
        </div>
        <p className="small muted">
          License: {ov.license_name}. Test outcomes and flow geometry: Appendix A of the report, read by us. Timelines: read
          by us from the overlay of the NASA videos (estimate).
        </p>
        <details>
          <summary>Objective, hypothesis and approach</summary>
          <div className="body">
            <h3>Hypothesis</h3>
            <p>{ov.hypothesis}</p>
            <h3>Objective</h3>
            <p className="b2-pre">{ov.objective}</p>
            <h3>Approach</h3>
            <p>{ov.approach}</p>
          </div>
        </details>
      </div>
    </section>
  );
}
