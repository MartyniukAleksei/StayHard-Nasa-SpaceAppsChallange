import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useTest } from "@/features/flex-tests";
import { chem, num, pct } from "@/shared/lib/format";
import { TimeChart, type Series } from "@/shared/ui/chart/TimeChart";
import { EndMark } from "@/shared/ui/EndMark";
import { useSignal } from "../api";
import { COOL_FLAME_OSCILLATORY, COOL_FLAME_STABLE } from "../coolFlameData";
import { column, findGaps, fitWindow, type Pt } from "../lib/cardData";
import { CARD_107, CARD_117, CARD_13, FIT_WINDOW_107, GAP_MIN_S, REFS, type Note } from "../testCards";

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

function Notes({ notes }: { notes: Note[] }) {
  return (
    <>
      <ul className="tc-notes">
        {notes.map((n) => (
          <li key={n.text}>
            <p>{n.text}</p>
            <p className="tc-refs mono small">
              {n.refs.map((id, i) => (
                <span key={id}>
                  {i > 0 && <span className="muted"> · </span>}
                  <a href={REFS[id].href} target="_blank" rel="noreferrer">
                    {REFS[id].label}
                  </a>
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function CardShell(props: {
  phenomenon: string;
  title: string;
  head: React.ReactNode;
  chart: React.ReactNode;
  notes: Note[];
  boxRef: React.Ref<HTMLElement>;
}) {
  return (
    <article className="tc" ref={props.boxRef}>
      <div className="tc-left">
        <p className="tc-kicker mono small">{props.phenomenon}</p>
        <h3 className="tc-title">{props.title}</h3>
        <div className="tc-head mono small">{props.head}</div>
        {props.chart}
      </div>
      <div className="tc-right">
        <h4 className="tc-sub mono small">What to know</h4>
        <Notes notes={props.notes} />
      </div>
    </article>
  );
}

function Pending({ text }: { text: string }) {
  return <p className="tc-wait mono small">{text}</p>;
}

function TestHead({ testNo }: { testNo: number }) {
  const { data: t } = useTest(testNo);
  if (!t) return <span>#{testNo}</span>;
  return (
    <>
      <Link to={`/studies/flex/tests/${t.test_no}`}>#{t.test_no}</Link> · {t.fuel} · {pct(t.x_o2)} O₂ in {chem(t.diluent)} ·{" "}
      {num(t.p_atm, 2, "atm")} · {t.fiber ? "on a fiber" : "free-floating"} · <EndMark type={t.end_type} />
    </>
  );
}

/** d² of test 107 with our fit, and the flame standoff ratio underneath. */
function Card107() {
  const [ref, near] = useNear<HTMLElement>();
  const droplet = useSignal(CARD_107.test, "droplet", near);
  const flame = useSignal(CARD_107.test, "flame_color", near);
  const { data: t } = useTest(CARD_107.test);

  const d2 = useMemo(() => column(droplet.data, "d_mm", (v) => v * v).filter(([x]) => x >= 0), [droplet.data]);
  const fsr = useMemo(() => column(flame.data, "standoff").filter(([x]) => x >= 0), [flame.data]);
  const fit = useMemo(() => fitWindow(d2, ...FIT_WINDOW_107), [d2]);

  const series: Series[] = [{ id: "d2", label: "d² measured", points: d2, kind: "dots" }];
  if (fit) {
    const line: Pt[] = FIT_WINDOW_107.map((x) => [x, fit.intercept + fit.slope * x]);
    series.push({ id: "fit", label: `our fit, ${FIT_WINDOW_107[0]}–${FIT_WINDOW_107[1]} s: K ≈ ${(-fit.slope).toFixed(2)} mm²/s (estimate)`, points: line, kind: "dashed", tone: "flame" });
  }
  return (
    <CardShell
      boxRef={ref}
      phenomenon={CARD_107.phenomenon}
      title={CARD_107.title}
      head={<TestHead testNo={CARD_107.test} />}
      notes={CARD_107.notes}
      chart={
        d2.length ? (
          <>
            <TimeChart series={series} xLabel="time, s" yLabel="d², mm²" height={230} ariaLabel={`Squared droplet diameter of test ${CARD_107.test} against time, with a straight-line fit`} />
            {t?.k_mm2_s != null && <p className="tc-cap mono small">NASA K for this test: {num(t.k_mm2_s, 2, "mm²/s")}</p>}
            {fsr.length > 0 && (
              <TimeChart series={[{ id: "fsr", label: "FSR = D_flame / d", points: fsr, kind: "dots" }]} xLabel="time, s" yLabel="FSR" height={170} ariaLabel={`Flame standoff ratio of test ${CARD_107.test} against time`} />
            )}
          </>
        ) : (
          <Pending text={near ? "Loading the series…" : "Chart loads here…"} />
        )
      }
    />
  );
}

/** d² of test 13 with the missing-frames stretch marked. */
function Card13() {
  const [ref, near] = useNear<HTMLElement>();
  const droplet = useSignal(CARD_13.test, "droplet", near);
  const d2 = useMemo(() => column(droplet.data, "d_mm", (v) => v * v), [droplet.data]);
  const gaps = useMemo(() => findGaps(d2, GAP_MIN_S), [d2]);
  return (
    <CardShell
      boxRef={ref}
      phenomenon={CARD_13.phenomenon}
      title={CARD_13.title}
      head={<TestHead testNo={CARD_13.test} />}
      notes={CARD_13.notes}
      chart={
        d2.length ? (
          <>
            <TimeChart
              series={[{ id: "d2", label: "d² measured", points: d2, kind: "dots" }]}
              gaps={gaps}
              legendExtra={gaps.length ? [{ id: "gap", label: "no measurements", swatch: "band" }] : []}
              xLabel="time, s"
              yLabel="d², mm²"
              height={230}
              ariaLabel={`Squared droplet diameter of test ${CARD_13.test} against time, with the stretch without frames shaded`}
            />
            {gaps.length > 0 && (
              <p className="tc-cap mono small">
                {gaps.map(([a, b]) => `${num(a, 2)}–${num(b, 2)} s (${num(b - a, 2)} s without frames)`).join(" · ")}
              </p>
            )}
          </>
        ) : (
          <Pending text={near ? "Loading the series…" : "Chart loads here…"} />
        )
      }
    />
  );
}

/** PSI-117: a numerical cool flame, two cases. Not a FLEX test. */
function Card117() {
  const [ref] = useNear<HTMLElement>();
  const stable = useMemo<Pt[]>(() => COOL_FLAME_STABLE.map((r) => [r[0], r[2]]), []);
  const osc = useMemo<Pt[]>(() => COOL_FLAME_OSCILLATORY.map((r) => [r[0], r[2]]), []);
  return (
    <CardShell
      boxRef={ref}
      phenomenon={CARD_117.phenomenon}
      title={CARD_117.title}
      head={
        <>
          {CARD_117.id} · simulation, not a measurement ·{" "}
          <a href={REFS.ahmed.href} target="_blank" rel="noreferrer">
            doi:10.60555/gz0q-b577
          </a>
        </>
      }
      notes={CARD_117.notes}
      chart={
        <TimeChart
          series={[
            { id: "stable", label: "stable cool flame", points: stable, kind: "line", tone: "ink" },
            { id: "osc", label: "oscillatory cool flame", points: osc, kind: "line", tone: "s2" },
          ]}
          xLabel="time, s"
          yLabel="T_max, K"
          yDomain={[500, 1250]}
          height={230}
          ariaLabel="Simulated peak gas temperature against time for a stable and an oscillatory cool flame"
        />
      }
    />
  );
}

/** Tests to read first: each card is a test, its chart and a few sourced points. Layout C: chart left, text right. */
export function TestCards() {
  return (
    <section className="band" aria-labelledby="cards-title">
      <div className="wrap">
        <h2 id="cards-title" className="h-section">Tests to read first</h2>
        <p className="lede">
          Three records that show what to look for in the data. Charts come from the same series as the tests; the
          text cites the paper behind each point.
        </p>
        <div className="tc-list">
          <Card107 />
          <Card13 />
          <Card117 />
        </div>
      </div>
    </section>
  );
}
