import { useId, useState, type MouseEvent } from "react";
import { useWidth } from "@/shared/lib/useWidth";
import { ChartLegend, type LegendItem } from "./ChartLegend";
import { DOT, MARGIN as M, type Tone } from "./theme";
import "./chart.css";

// SVG chart in the StayHard theme, style A "instrument" (docs/design/charts-variants.html):
// graph-paper grid at the ticks, framed plot, measurements = hollow circles, our estimates =
// blue dashed line, gaps = hatched band, events = blue marks, a crosshair with the value under
// the mouse. Series names live in the legend bottom-right under the chart, never on the plot.

export type { Tone } from "./theme";
export type Point = [x: number, y: number];
export type Series = {
  id: string;
  label?: string;
  points: Point[];
  kind?: "dots" | "line" | "dashed";
  tone?: Tone;
};
export type Marker = { x: number; label: string };
/** A time range with no measurements, shaded and labelled on the chart. */
export type Gap = [from: number, to: number];

type Props = {
  series: Series[];
  xLabel: string;
  yLabel: string;
  ariaLabel: string;
  height?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  cursor?: number | null;
  markers?: Marker[];
  gaps?: Gap[];
  /** Extra legend entries (e.g. for a gap band). The series with a label are listed first. */
  legendExtra?: LegendItem[];
};

export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const err = raw / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}

export function extent(series: Series[], axis: 0 | 1): [number, number] {
  const vals = series.flatMap((s) => s.points.map((p) => p[axis]));
  if (vals.length === 0) return [0, 1];
  return [Math.min(...vals), Math.max(...vals)];
}

const fmtTick = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : String(Number(v.toFixed(2))));
const fmtVal = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

/** "time, s" -> { name: "time", unit: "s" } for the crosshair readout. */
function axisName(label: string): { name: string; unit: string } {
  const [name, unit = ""] = label.split(",").map((x) => x.trim());
  return { name, unit };
}
/** Readout flips to the left of the crosshair this close to the right edge, px. */
const READOUT_FLIP = 170;

const SWATCH = { dots: "dots", line: "line", dashed: "dashed" } as const;
/** Marker labels flip to the left of their line when this close to the right edge, px. */
const FLIP_PX = 80;

export function TimeChart(props: Props) {
  const { series, xLabel, yLabel, ariaLabel, height = 220, cursor, markers = [], gaps = [], legendExtra = [] } = props;
  const [ref, W] = useWidth<HTMLDivElement>();
  const [ex0, ex1] = extent(series, 0);
  const [, ey1] = extent(series, 1);
  const [x0, x1] = props.xDomain ?? [Math.min(0, ex0), ex1 || 1];
  const [y0, y1] = props.yDomain ?? [0, (ey1 || 1) * 1.05];
  const H = height;
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  const inX = (v: number) => v >= x0 && v <= x1;
  const clampX = (v: number) => Math.min(x1, Math.max(x0, v));

  const hatch = `hatch-${useId().replace(/:/g, "")}`;
  const [hover, setHover] = useState<Point | null>(null);
  const probe = series.find((s) => s.kind !== "line" && s.kind !== "dashed" && s.points.length) ?? series[0];
  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!probe?.points.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (px < M.l || px > W - M.r) return setHover(null);
    const t = x0 + ((px - M.l) / (W - M.l - M.r)) * (x1 - x0);
    let best = probe.points[0];
    for (const p of probe.points) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    setHover(inX(best[0]) ? best : null);
  };
  const xn = axisName(xLabel);
  const yn = axisName(yLabel);

  const legend: LegendItem[] = [
    ...series
      .filter((s) => s.label)
      .map((s) => ({ id: s.id, label: s.label!, swatch: SWATCH[s.kind ?? "dots"], tone: s.tone })),
    ...legendExtra,
  ];

  return (
    <div ref={ref} className="tchart">
      <svg width={W} height={H} role="img" aria-label={ariaLabel} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line className="hatch" x1="0" y1="0" x2="0" y2="6" />
          </pattern>
        </defs>
        {niceTicks(x0, x1).map((t) => (
          <g key={`x${t}`}>
            <line className="grid" x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} />
            <text x={sx(t)} y={H - M.b + 16} textAnchor="middle">
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {niceTicks(y0, y1, 4).map((t) => (
          <g key={`y${t}`}>
            <line className="grid" x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} />
            <text x={M.l - 8} y={sy(t) + 4} textAnchor="end">
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {gaps.map(([a, b]) => (
          <rect
            key={`g${a}`}
            className="gap"
            fill={`url(#${hatch})`}
            x={sx(clampX(a))}
            y={M.t}
            width={Math.max(0, sx(clampX(b)) - sx(clampX(a)))}
            height={H - M.t - M.b}
          />
        ))}
        <rect className="frame" x={M.l} y={M.t} width={Math.max(0, W - M.l - M.r)} height={H - M.t - M.b} />
        <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" className="axlabel">
          {xLabel}
        </text>
        <text x={M.l} y={M.t - 6} className="axlabel">
          {yLabel}
        </text>
        {series.map((s) => (
          <SeriesMarks key={s.id} s={s} sx={sx} sy={sy} inX={inX} />
        ))}
        {markers.filter((m) => inX(m.x)).map((m) => {
          const flip = sx(m.x) > W - M.r - FLIP_PX;
          return (
            <g key={m.label} className="marker">
              <line x1={sx(m.x)} y1={M.t} x2={sx(m.x)} y2={H - M.b} />
              <text x={sx(m.x) + (flip ? -6 : 6)} y={M.t + 10} textAnchor={flip ? "end" : "start"}>
                {m.label}
              </text>
            </g>
          );
        })}
        {cursor != null && inX(cursor) && (
          <line className="cursor" x1={sx(cursor)} y1={M.t} x2={sx(cursor)} y2={H - M.b} />
        )}
        {hover && (
          <g className="crosshair" aria-hidden="true">
            <line x1={sx(hover[0])} x2={sx(hover[0])} y1={M.t} y2={H - M.b} />
            <circle cx={sx(hover[0])} cy={sy(hover[1])} r={4} />
            <text
              x={sx(hover[0]) + (sx(hover[0]) > W - M.r - READOUT_FLIP ? -8 : 8)}
              y={Math.max(M.t + 12, sy(hover[1]) - 10)}
              textAnchor={sx(hover[0]) > W - M.r - READOUT_FLIP ? "end" : "start"}
            >
              {xn.name} {fmtVal(hover[0])} {xn.unit} · {yn.name} {fmtVal(hover[1])} {yn.unit}
            </text>
          </g>
        )}
      </svg>
      {legend.length > 0 && <ChartLegend items={legend} align="right" label="What the marks mean" />}
    </div>
  );
}

function SeriesMarks({ s, sx, sy, inX }: {
  s: Series;
  sx: (v: number) => number;
  sy: (v: number) => number;
  inX: (v: number) => boolean;
}) {
  const pts = s.points.filter((p) => inX(p[0]));
  if (pts.length === 0) return null;
  const tone = `tone-${s.tone ?? "ink"}`;
  if (s.kind === "line" || s.kind === "dashed") {
    return (
      <g className={tone}>
        <polyline
          className={s.kind === "dashed" ? "dashed" : undefined}
          points={pts.map((p) => `${sx(p[0])},${sy(p[1])}`).join(" ")}
        />
      </g>
    );
  }
  return (
    <g className={`${tone} measured`}>
      {pts.map((p, i) => (
        <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={DOT} />
      ))}
    </g>
  );
}
