import { Link } from "react-router";
import { num } from "@/shared/lib/format";
import { useWidth } from "@/shared/lib/useWidth";
import { niceTicks } from "@/shared/ui/chart/TimeChart";
import { glyphOf, HERO_CONTEXT, HERO_QUESTION, MATERIAL_GLYPH, VERDICT_LABEL } from "../content";
import { sampleHref, samplesHref } from "../lib/links";
import { logPos } from "../lib/series";
import type { Dashboard, Sample } from "../types";

export const Derived = () => <span className="tag sf-derived">derived</span>;

/** A: question, context, key numbers, the main action and a meta row (as the FLEX hero). */
export function Hero({ data }: { data: Dashboard }) {
  const { about, samples, co2_timeline } = data;
  const burnedUg = samples.filter((s) => (s.ug_burn_cm ?? 0) > 0).length;
  const stricter = samples.filter((s) => s.verdict === "earth_stricter").length;
  const co2 = co2_timeline.flatMap((t) => t.points);
  const hours = co2.length ? co2[co2.length - 1][0] / 60 : null;
  return (
    <section className="band" aria-labelledby="sf-title">
      <div className="wrap sf-hero">
        <p className="sf-kicker mono">
          {about.acronym} · {about.title} · {about.flight_program}
        </p>
        <h1 id="sf-title" className="h-display">{HERO_QUESTION}</h1>
        <p className="lede">{HERO_CONTEXT}</p>
        <div className="stats sf-stats">
          <Stat value={samples.length} label="samples, one card" />
          <Stat value={burnedUg} label="burned in microgravity" />
          <Stat value={stricter} label="where the 1g test was stricter (derived)" />
          <Stat value={num(hours, 1, "h")} label="of flight data, one recording per sample" />
        </div>
        <div className="sf-cta">
          <Link className="btn" to={samplesHref()}>
            Browse all samples →
          </Link>
        </div>
        <p className="sf-meta mono small">
          {about.acronym} · {about.accession} · {about.flight_program} · {about.start_date} – {about.end_date} ·{" "}
          {samples.length} samples ·{" "}
          <a href={`https://doi.org/${about.doi}`} target="_blank" rel="noreferrer">
            doi:{about.doi}
          </a>
        </p>
      </div>
    </section>
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

const sampleLine = (s: Sample) => [s.material, s.thickness_raw, s.flow_direction].filter(Boolean).join(" · ");

/** Burned length in µg vs the 1g upward test, with a verdict, for the given samples. */
export function EarthVsSpaceChart({ data, ids }: { data: Dashboard; ids?: string[] }) {
  const full = data.sample_length_cm;
  const rows = ids ? data.samples.filter((s) => ids.includes(s.test_id)) : data.samples;
  return (
    <>
      <ul className="sf-ev" role="list">
        {rows.map((s) => (
          <li key={s.test_id} className="sf-ev-row">
            <div className="sf-ev-head">
              <Link className="mono sf-ev-id" to={sampleHref(s.test_id)}>
                {s.test_id}
              </Link>
              <span className="sf-glyph" aria-hidden="true">{glyphOf(s.material).glyph}</span>
              <span className="muted small">{sampleLine(s)}</span>
            </div>
            <div className="sf-ev-bars">
              <Bar k="µg" v={s.ug_burn_cm} full={full} raw={s.ug_burn_length_raw} />
              <Bar k="1g" v={s.g1_burn_cm} full={full} raw={s.g1_burn_length_raw} earth />
            </div>
            <span className={`tag sf-verdict v-${s.verdict}`}>{VERDICT_LABEL[s.verdict]}</span>
          </li>
        ))}
      </ul>
      <p className="sf-tc-cap mono small">
        Burned length out of {full} cm: ‘Complete’ is drawn as the full length, ‘~ 0’ as zero; the raw table text sits
        next to each bar. Verdict is our comparison (derived).
      </p>
    </>
  );
}

function Bar({ k, v, full, raw, earth }: { k: string; v: number | null; full: number; raw: string; earth?: boolean }) {
  const w = v == null ? 0 : Math.min(100, (v / full) * 100);
  return (
    <div className={`sf-bar${earth ? " earth" : ""}`}>
      <span className="mono sf-bar-k">{k}</span>
      <span className="sf-track" aria-hidden="true">
        <i style={{ width: `${w}%` }} />
      </span>
      <span className="mono sf-bar-v">{v == null ? "—" : `${v} cm`}</span>
      <span className="muted small sf-raw" title="value in the PSI experiment table">
        {raw || "—"}
      </span>
    </div>
  );
}

const LOG_LO = 0.005;
const LOG_HI = 5;

/** Flame spread rate on a log axis, µg vs 1g. */
export function SpreadPlot({ data }: { data: Dashboard }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const narrow = W < 560;
  const L = narrow ? 44 : Math.min(120, W * 0.2);
  const R = narrow ? 44 : Math.min(140, W * 0.3); // right column: 1g "accelerating" note
  const rowH = 26;
  const H = data.samples.length * rowH + 40;
  const x = (v: number) => L + logPos(v, LOG_LO, LOG_HI) * (W - L - R);
  const ticks = narrow ? [0.01, 1] : [0.01, 0.1, 1];
  return (
    <>
      <div ref={ref} className="sf-svg">
        <svg width={W} height={H} role="img" aria-label="Flame spread rate per sample, microgravity vs 1g, log scale">
          {ticks.map((t) => (
            <g key={t}>
              <line className="sf-grid" x1={x(t)} x2={x(t)} y1={8} y2={H - 26} />
              <text x={x(t)} y={H - 10} textAnchor="middle">{t} mm/s</text>
            </g>
          ))}
          {data.samples.map((s, i) => {
            const y = 18 + i * rowH;
            const u = s.ug_spread;
            const g = s.g1_spread;
            return (
              <g key={s.test_id}>
                <text x={0} y={y + 4} className="sf-rowlabel">
                  {s.test_id} {glyphOf(s.material).glyph}
                </text>
                {u.lo != null && u.hi != null && u.lo !== u.hi && (
                  <g className="sf-ug">
                    <line x1={x(u.lo)} x2={x(u.hi)} y1={y} y2={y} />
                    <line x1={x(u.lo)} x2={x(u.lo)} y1={y - 5} y2={y + 5} />
                    <line x1={x(u.hi)} x2={x(u.hi)} y1={y - 5} y2={y + 5} />
                    <text x={x(u.hi) + 8} y={y + 4}>µg {u.lo}–{u.hi}{narrow ? "" : ` (${u.note})`}</text>
                  </g>
                )}
                {u.lo != null && u.lo === u.hi && (
                  <g className="sf-ug">
                    <rect x={x(u.lo) - 4} y={y - 4} width={8} height={8} />
                    <text x={x(u.lo) - 10} y={y + 4} textAnchor="end">µg {u.lo}</text>
                  </g>
                )}
                {g.lo != null && (
                  <g className="sf-g1">
                    <rect x={x(g.lo) - 4} y={y - 4} width={8} height={8} />
                    <text x={x(g.lo) + 10} y={y + 4}>1g {g.lo}</text>
                  </g>
                )}
                {u.lo == null && (
                  <text x={L} y={y + 4} className="sf-none">{narrow ? "µg: none" : "µg: no spread"}</text>
                )}
                {g.accelerating && (
                  <text x={W} y={y + 4} textAnchor="end" className="sf-g1t">{narrow ? "1g ↑" : "1g ↑ accelerating"}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="sf-tc-cap mono small">■ µg · □ 1g · 1g ↑ = accelerating (no number in the table). Thick PMMA range: Note 4.</p>
    </>
  );
}

/** Peak sample temperature against CO₂ rise: two burning signatures (derived from the sensors). */
export function SignatureScatter({ data }: { data: Dashboard }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const M = { l: 52, r: 24, t: 16, b: 40 };
  const H = 260;
  const pts = data.samples
    .filter((s) => s.sensors?.peak_sample_t_c != null && s.sensors.co2_rise_pct != null)
    .map((s) => ({ s, x: s.sensors!.co2_rise_pct! * 10000, y: s.sensors!.peak_sample_t_c! }));
  const xMax = Math.max(100, ...pts.map((p) => p.x)) * 1.1;
  const yMax = Math.max(100, ...pts.map((p) => p.y)) * 1.1;
  const sx = (v: number) => M.l + (v / xMax) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - (v / yMax) * (H - M.t - M.b);
  const placed: { x: number; y: number }[] = [];
  const labelDy = (px: number, py: number) => {
    const near = placed.filter((p) => Math.abs(p.x - px) < 40 && Math.abs(p.y - py) < 40).length;
    placed.push({ x: px, y: py });
    return near * 13;
  };
  return (
    <>
      <div ref={ref} className="sf-svg">
        <svg width={W} height={H} role="img" aria-label="Peak sample temperature against CO2 rise for each sample">
          <line className="sf-axis" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
          <line className="sf-axis" x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} />
          {niceTicks(0, xMax, 4).filter((v) => v <= xMax).map((t) => (
            <text key={`x${t}`} x={sx(t)} y={H - M.b + 16} textAnchor="middle">{t}</text>
          ))}
          {niceTicks(0, yMax, 4).filter((v) => v <= yMax).map((t) => (
            <text key={`y${t}`} x={M.l - 8} y={sy(t) + 4} textAnchor="end">{t}</text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" className="sf-axlabel">CO₂ rise during the test, ppm</text>
          <text x={M.l} y={M.t - 4} className="sf-axlabel">peak sample T, °C</text>
          {pts.map(({ s, x, y }) => {
            const px = sx(x);
            const py = sy(y);
            return (
              <g key={s.test_id} className="sf-pt">
                <text x={px} y={py + 5} textAnchor="middle" className="sf-glyph-svg">{glyphOf(s.material).glyph}</text>
                <text x={px + 10} y={py - 6 + labelDy(px, py)}>{s.test_id}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="sf-tc-cap mono small sf-legend">
        {MATERIAL_GLYPH.map((m) => (
          <span key={m.label}>
            {m.glyph} {m.label}
          </span>
        ))}
      </p>
    </>
  );
}
