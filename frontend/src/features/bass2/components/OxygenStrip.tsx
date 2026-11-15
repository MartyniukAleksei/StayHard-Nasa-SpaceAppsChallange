import { useState } from "react";
import { useNavigate } from "react-router";
import { ChartTooltip } from "@/shared/ui/chart/ChartTooltip";
import { MARGIN } from "@/shared/ui/chart/theme";
import { useWidth } from "@/shared/lib/useWidth";
import { testHref } from "../api";
import { jitter, OUTCOME_ORDER, OUTCOMES, outcomeStyle } from "../lib/outcomes";
import type { FlowConfig, TestRow } from "../types";
import { Glyph } from "./Glyph";

const LANES: { key: FlowConfig | "none"; label: string }[] = [
  { key: "Stagnation", label: "Stagnation (rod tip)" },
  { key: "Concurrent", label: "Concurrent (with flow)" },
  { key: "Opposed", label: "Opposed (against flow)" },
  { key: "none", label: "Not in report log" },
];
const LANE_H = 64;
const STEP = 7; // px between stacked glyphs
const LEFT = 150;

export type RefLine = { x: number; label: string; tone: "flame" | "ash" };

/** Every test on one oxygen axis: one lane per flow geometry, glyph = outcome (derived). */
export function OxygenStrip({ tests, refs }: { tests: TestRow[]; refs: RefLine[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ t: TestRow; x: number; y: number } | null>(null);
  const navigate = useNavigate();
  const w = Math.max(width, 320);
  const narrow = w < 640;
  const left = narrow ? 8 : LEFT;
  const lanes = LANES.filter((l) => tests.some((t) => (t.flow_config ?? "none") === l.key));
  const laneH = narrow ? LANE_H + 18 : LANE_H;
  const h = MARGIN.t + lanes.length * laneH + MARGIN.b;

  const xs = tests.map((t) => t.o2_initial_pct).filter((v): v is number => v != null);
  const lo = Math.floor(Math.min(...xs, ...refs.map((r) => r.x)) - 0.5);
  const hi = Math.ceil(Math.max(...xs) + 0.5);
  const sx = (v: number) => left + ((v - lo) / (hi - lo)) * (w - left - MARGIN.r);

  const points = lanes.flatMap((lane, li) => {
      const rows = tests
        .filter((t) => (t.flow_config ?? "none") === lane.key && t.o2_initial_pct != null)
        .sort((a, b) => OUTCOME_ORDER.indexOf(a.outcome ?? "unknown") - OUTCOME_ORDER.indexOf(b.outcome ?? "unknown"));
      const jit = jitter(rows.map((r) => r.o2_initial_pct), 0.25);
      const cy = MARGIN.t + li * laneH + (narrow ? 18 : 0) + laneH / 2 - (narrow ? 9 : 0);
    return rows.map((t, i) => ({ t, x: sx(t.o2_initial_pct!), y: cy + jit[i] * STEP }));
  });

  const ticks: number[] = [];
  for (let v = lo; v <= hi; v++) ticks.push(v);

  return (
    <div className="b2-strip" ref={ref}>
      <svg
        width={w}
        height={h}
        role="img"
        aria-label="Initial oxygen of every BASS-II test by flow geometry; glyph shows how the test ended"
      >
        {lanes.map((lane, li) => {
          const y0 = MARGIN.t + li * laneH;
          return (
            <g key={lane.key}>
              <line x1={left} x2={w - MARGIN.r} y1={y0 + laneH} y2={y0 + laneH} className="b2-grid" />
              <text x={narrow ? left : left - 10} y={narrow ? y0 + 12 : y0 + laneH / 2 + 4} textAnchor={narrow ? "start" : "end"} className="b2-axis">
                {lane.label}
              </text>
            </g>
          );
        })}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={MARGIN.t} y2={h - MARGIN.b} className="b2-grid" />
            <text x={sx(v)} y={h - MARGIN.b + 16} textAnchor="middle" className="b2-axis">
              {v}
            </text>
          </g>
        ))}
        <text x={w - MARGIN.r} y={h - 4} textAnchor="end" className="b2-axis">
          initial O₂, % by volume
        </text>
        {refs.map((r) => (
          <g key={r.label}>
            <line
              x1={sx(r.x)}
              x2={sx(r.x)}
              y1={MARGIN.t - 6}
              y2={h - MARGIN.b}
              className={r.tone === "flame" ? "b2-ref on" : "b2-ref"}
            />
          </g>
        ))}
        {points.map(({ t, x, y }) => (
          <g
            key={t.test_id}
            transform={`translate(${x},${y})`}
            className="b2-pt"
            tabIndex={0}
            role="link"
            aria-label={`Test ${t.test_id}: ${outcomeStyle(t.outcome).short}, ${t.o2_initial_pct}% O₂`}
            onMouseEnter={() => setHover({ t, x, y })}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover({ t, x, y })}
            onBlur={() => setHover(null)}
            onClick={() => navigate(testHref(t.test_id))}
            onKeyDown={(e) => e.key === "Enter" && navigate(testHref(t.test_id))}
          >
            <rect x={-8} y={-5} width={16} height={10} fill="transparent" />
            <Glyph outcome={t.outcome} />
          </g>
        ))}
      </svg>
      {hover && (
        <ChartTooltip id="b2-strip-tip" x={hover.x} y={hover.y} width={w}>
          <b className="mono">{hover.t.test_id}</b> · {hover.t.material}
          <br />
          <span className="mono">{hover.t.o2_initial_pct}% O₂</span> · {outcomeStyle(hover.t.outcome).label}
        </ChartTooltip>
      )}
      <ul className="b2-legend mono small">
        {refs.map((r) => (
          <li key={r.label}>
            <span className={r.tone === "flame" ? "b2-ref-key on" : "b2-ref-key"} aria-hidden="true" /> {r.label}
          </li>
        ))}
        {OUTCOME_ORDER.filter((k) => tests.some((t) => (t.outcome ?? "unknown") === k && t.flow_config)).map((k) => (
          <li key={k}>
            <svg width="12" height="12" aria-hidden="true">
              <g transform="translate(6,6)">
                <Glyph outcome={k} />
              </g>
            </svg>{" "}
            {OUTCOMES[k].short}
          </li>
        ))}
      </ul>
    </div>
  );
}
