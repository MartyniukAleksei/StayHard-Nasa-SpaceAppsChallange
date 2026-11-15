import { useMemo } from "react";
import { Link } from "react-router";
import { useTest } from "@/features/flex-tests";
import { num } from "@/shared/lib/format";
import { TimeChart, type Series } from "@/shared/ui/chart/TimeChart";
import { useSignal } from "../api";
import { FINDINGS, type Finding } from "../content";
import { column, findGaps, type Pt } from "../lib/cardData";
import { GAP_MIN_S } from "../testCards";
import { Pending, RefLinks, TestHead, useNear } from "./cardParts";

const csvUrl = (n: number) => `${import.meta.env.VITE_API_URL ?? ""}/api/studies/flex/tests/${n}/series.csv`;

/** Sentences of the researchers' test comment that match a pattern, quoted as they are in the data. */
function quote(comment: string | null | undefined, re: RegExp): string | null {
  const hit = (comment ?? "").split(/(?<=\.)\s+/).filter((s) => re.test(s));
  return hit.length ? hit.join(" ") : null;
}

/** First time the flame diameter is zero after it has been positive: the end of the visible flame. */
function visibleFlameOut(flame: Pt[]): number | null {
  let seen = false;
  for (const [t, v] of flame) {
    if (v > 0) seen = true;
    else if (seen) return t;
  }
  return null;
}

function Evidence({ kind }: { kind: Finding["evidence"] }) {
  return <span className={`tc-ev tc-ev-${kind}`}>{kind === "measured" ? "measured" : "derived from measurements"}</span>;
}

/** Test 35: d² goes on falling after the visible flame is out. */
function Chart35() {
  const droplet = useSignal(35, "droplet");
  const flame = useSignal(35, "flame_color");
  const d2 = useMemo(() => column(droplet.data, "d_mm", (v) => v * v).filter(([x]) => x >= 0), [droplet.data]);
  const out = useMemo(() => visibleFlameOut(column(flame.data, "flame_d_mm")), [flame.data]);
  if (!d2.length) return <Pending text="Loading the series…" />;
  const before = out == null ? d2 : d2.filter(([x]) => x <= out);
  const after = out == null ? [] : d2.filter(([x]) => x > out);
  const series: Series[] = [{ id: "burn", label: "d², flame visible", points: before, kind: "dots" }];
  if (after.length) series.push({ id: "after", label: "d², after the visible flame is out", points: after, kind: "dots", tone: "uv" });
  return (
    <>
      <TimeChart series={series} markers={out == null ? [] : [{ x: out, label: `flame out ${num(out, 1)} s` }]} xLabel="time, s" yLabel="d², mm²" height={230} ariaLabel="Squared droplet diameter of test 35 against time; the droplet keeps vaporising after the visible flame is out" />
    </>
  );
}

/** Tests 35 (free) and 49 (fiber): normalised d² of the same fuel and ambient, side by side. */
function Chart49() {
  const free = useTest(35);
  const fib = useTest(49);
  const dFree = useSignal(35, "droplet");
  const dFib = useSignal(49, "droplet");
  const t0 = 0;
  const t1 = 8;
  const norm = (s: typeof dFree.data, d0: number | null | undefined): Pt[] =>
    d0 ? column(s, "d_mm", (v) => (v / d0) ** 2).filter(([x]) => x >= t0 && x <= t1) : [];
  const a = useMemo(() => norm(dFree.data, free.data?.d0_mm), [dFree.data, free.data]);
  const b = useMemo(() => norm(dFib.data, fib.data?.d0_mm), [dFib.data, fib.data]);
  const gaps = useMemo(() => findGaps(b, GAP_MIN_S), [b]);
  if (!a.length || !b.length) return <Pending text="Loading the series…" />;
  return (
    <>
      <TimeChart
        series={[
          { id: "free", label: "#35 free-floating", points: a, kind: "dots" },
          { id: "fiber", label: "#49 on a fiber", points: b, kind: "dots", tone: "uv" },
        ]}
        gaps={gaps}
        legendExtra={gaps.length ? [{ id: "gap", label: "no measurements (#49)", swatch: "band" }] : []}
        xLabel="time, s"
        yLabel="(d/d₀)², –"
        yDomain={[0, 1.05]}
        height={230}
        ariaLabel="Normalised squared droplet diameter of heptane test 35 (free-floating) and test 49 (on a fiber) against time"
      />
      <p className="tc-cap mono small">
        NASA K, same fuel and ambient: #35 {num(free.data?.k_mm2_s, 2, "mm²/s")} free-floating · #49{" "}
        {num(fib.data?.k_mm2_s, 2, "mm²/s")} on a fiber. d₀: {num(free.data?.d0_mm, 2, "mm")} and {num(fib.data?.d0_mm, 2, "mm")}.
      </p>
    </>
  );
}

/** Test 34: the record ends with the droplet still large. */
function Chart34() {
  const droplet = useSignal(34, "droplet");
  const { data: t } = useTest(34);
  const d2 = useMemo(() => column(droplet.data, "d_mm", (v) => v * v).filter(([x]) => x >= 0), [droplet.data]);
  if (!d2.length) return <Pending text="Loading the series…" />;
  const last = d2[d2.length - 1];
  const left = t?.d0_mm ? last[1] / t.d0_mm ** 2 : null;
  return (
    <>
      <TimeChart series={[{ id: "d2", label: "d² measured", points: d2, kind: "dots" }]} markers={[{ x: last[0], label: `record ends ${num(last[0], 1)} s` }]} xLabel="time, s" yLabel="d², mm²" height={230} ariaLabel="Squared droplet diameter of methanol test 34 against time; the record ends with the droplet still large" />
      {left != null && (
        <p className="tc-cap mono small">
          At the last point d² is {num(left * 100, 0)}% of d₀² (derived). No flame series exists for this test.
        </p>
      )}
    </>
  );
}

const CHARTS: Record<number, () => React.ReactNode> = { 35: Chart35, 49: Chart49, 34: Chart34 };

function FindingCard({ f }: { f: Finding }) {
  const [ref, near] = useNear<HTMLElement>();
  const { data: t } = useTest(f.test);
  const Chart = CHARTS[f.test];
  const q = f.test === 35 ? quote(t?.comment, /cool flame/i) : f.test === 34 ? quote(t?.comment, /extinction droplet diameter/i) : null;
  return (
    <article className="tc" ref={ref}>
      <div className="tc-left">
        <p className="tc-kicker mono small">
          Finding · <Evidence kind={f.evidence} />
        </p>
        <div className="tc-head mono small">
          <TestHead testNo={f.test} />
        </div>
        {near ? <Chart /> : <Pending text="Chart loads here…" />}
      </div>
      <div className="tc-right">
        <p className="tc-claim">{f.claim}</p>
        {q && (
          <blockquote className="ov-quote">
            “{q}”<cite className="mono">researcher comment, test #{f.test}</cite>
          </blockquote>
        )}
        <p className="tc-caveat small"><b className="mono">Keep in mind</b> {f.caveat}</p>
        <RefLinks ids={f.refs} />
        <p className="tc-refs mono small">
          <Link to={`/studies/flex/tests/${f.test}`}>open test #{f.test}</Link>
          <span className="muted"> · </span>
          <a href={csvUrl(f.test)}>series.csv</a>
        </p>
      </div>
    </article>
  );
}

/** D: what was found: each finding with the test that shows it, a chart, its caveat and its papers. */
export function Findings() {
  if (FINDINGS.length === 0) return null;
  return (
    <section className="band" aria-labelledby="found-title">
      <div className="wrap">
        <h2 id="found-title" className="h-section">What was found</h2>
        <p className="lede">Three results from the FLEX papers, each with the test that shows it.</p>
        <div className="tc-list">
          {FINDINGS.map((f) => (
            <FindingCard key={f.test} f={f} />
          ))}
        </div>
      </div>
    </section>
  );
}
