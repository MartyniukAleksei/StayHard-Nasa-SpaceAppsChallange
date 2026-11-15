import { useState } from "react";
import { useNavigate } from "react-router";
import { PTRAK_LIMIT } from "@/features/same-r-3d";
import { useWidth } from "@/shared/lib/useWidth";
import { niceTicks } from "@/shared/ui/chart/TimeChart";
import { AXES, axis, dodge, type Axis } from "../lib/map";
import { markIndexer, type TestGroup } from "../lib/tests";
import { Shape } from "./Mark";

// All tests on one map, axes chosen by the reader in selectors at the ends of the axes. Each test is a mark
// per material; tests outside the filters are faint. Overlapping marks are spread sideways (display only).

const M = { l: 60, r: 16, t: 12, b: 26 };
const H = 300;
const GAP = 12; // px between marks after spreading
const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷" };

type Scale = { to: (v: number) => number; ticks: { v: number; label: string }[] };

function scale(a: Axis, vals: number[], p0: number, p1: number): Scale {
  if (a.log) {
    const e0 = Math.floor(Math.log10(Math.min(...vals)));
    const e1 = Math.ceil(Math.log10(Math.max(...vals, a.id === "peak" ? PTRAK_LIMIT : 0)));
    const to = (v: number) => p0 + ((Math.log10(v) - e0) / (e1 - e0 || 1)) * (p1 - p0);
    const ticks = Array.from({ length: e1 - e0 + 1 }, (_, i) => e0 + i).map((e) => ({
      v: 10 ** e,
      label: `10${String(e).split("").map((c) => SUP[c]).join("")}`,
    }));
    return { to, ticks };
  }
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.04 || 1;
  const [v0, v1] = [lo - pad, hi + pad];
  const to = (v: number) => p0 + ((v - v0) / (v1 - v0)) * (p1 - p0);
  const ticks = niceTicks(v0, v1, 6).map((v) => ({ v, label: String(Number(v.toFixed(3))) }));
  return { to, ticks };
}

type Props = { groups: TestGroup[]; hits: Set<number>; href: (n: number) => string };

export function TestMap({ groups, hits, href }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>(700, 300);
  const [xId, setX] = useState("heater");
  const [yId, setY] = useState("peak");
  const navigate = useNavigate();
  const mark = markIndexer(groups);
  const ax = axis(xId);
  const ay = axis(yId);
  const pts = groups.flatMap((g) => {
    const x = ax.get(g);
    const y = ay.get(g);
    return x != null && y != null ? [{ g, x, y }] : [];
  });

  const sx = pts.length ? scale(ax, pts.map((p) => p.x), M.l, W - M.r) : null;
  const sy = pts.length ? scale(ay, pts.map((p) => p.y), H - M.b, M.t) : null;
  const xs = sx && sy ? dodge(pts.map((p) => ({ x: sx.to(p.x), y: sy.to(p.y) })), GAP) : [];
  const limitY = sy && ay.id === "peak" ? sy.to(PTRAK_LIMIT) : null;

  return (
    <div className="sr-map">
      <div className="sr-axis-row">
        <AxisPicker name="Vertical" glyph="↑" value={yId} other={xId} onChange={setY} />
      </div>
      <div ref={ref}>
        {sx && sy ? (
          <svg width={W} height={H} role="img" aria-label={`Map of ${pts.length} tests: ${ax.label} against ${ay.label}`}>
            {sy.ticks.map((t) => (
              <g key={`y${t.v}`}>
                <line className="sr-map-grid" x1={M.l} x2={W - M.r} y1={sy.to(t.v)} y2={sy.to(t.v)} />
                <text x={M.l - 8} y={sy.to(t.v) + 4} textAnchor="end">
                  {t.label}
                </text>
              </g>
            ))}
            {sx.ticks.map((t) => (
              <text key={`x${t.v}`} x={sx.to(t.v)} y={H - 8} textAnchor="middle">
                {t.label}
              </text>
            ))}
            {limitY != null && (
              <>
                <line className="sr-map-limit" x1={M.l} x2={W - M.r} y1={limitY} y2={limitY} />
                <text x={W - M.r} y={limitY - 5} textAnchor="end">
                  P-Trak limit: at least this
                </text>
              </>
            )}
            {pts.map(({ g, x, y }, i) => {
              const to = href(g.test_no);
              return (
                <a
                  key={g.test_no}
                  href={to}
                  onClick={(ev) => {
                    ev.preventDefault();
                    navigate(to);
                  }}
                  className={hits.has(g.test_no) ? "sr-map-pt" : "sr-map-pt off"}
                >
                  <title>
                    #{g.main.test_id} · {g.main.material} · {g.main.description} · {ax.label}: {x} · {ay.label}: {y}
                  </title>
                  <g transform={`translate(${xs[i]} ${sy.to(y)})`}>
                    <circle r={8} fill="transparent" />
                    <Shape i={mark(g.main.material)} />
                  </g>
                </a>
              );
            })}
          </svg>
        ) : (
          <p className="small muted">No test has both values.</p>
        )}
      </div>
      <div className="sr-axis-row end">
        <AxisPicker name="Horizontal" glyph="→" value={xId} other={yId} onChange={setX} after />
      </div>
    </div>
  );
}

// The arrow matches the direction the axis runs: Y sits above its axis, X below its axis.
function AxisPicker({ name, glyph, value, other, onChange, after }: { name: string; glyph: string; value: string; other: string; onChange: (id: string) => void; after?: boolean }) {
  const g = (
    <span className="sr-axis-g mono" aria-hidden="true">
      {glyph}
    </span>
  );
  return (
    <label className="sr-axis">
      {!after && g}
      <span className="sr-sel">
        <select value={value} aria-label={`${name} axis`} onChange={(e) => onChange(e.target.value)}>
          {AXES.filter((a) => a.id !== other).map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </span>
      {after && g}
    </label>
  );
}
