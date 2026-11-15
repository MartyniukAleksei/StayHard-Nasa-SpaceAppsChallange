import { useWidth } from "@/shared/lib/useWidth";
import { ChartLegend, type LegendItem } from "./ChartLegend";
import { DOT, MARGIN as M, type Tone } from "./theme";
import "./chart.css";

// SVG chart in the StayHard theme (shared/ui/chart/theme.ts): measurements are raster dots,
// models thin lines, our estimates dashed, events blue marks; series names go in the legend
// under the chart so they are never clipped by the plot area.

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

  const legend: LegendItem[] = [
    ...series
      .filter((s) => s.label)
      .map((s) => ({ id: s.id, label: s.label!, swatch: SWATCH[s.kind ?? "dots"], tone: s.tone })),
    ...legendExtra,
  ];

  return (
    <div ref={ref} className="tchart">
      <svg width={W} height={H} role="img" aria-label={ariaLabel}>
        {gaps.map(([a, b]) => (
          <rect
            key={`g${a}`}
            className="gap"
            x={sx(clampX(a))}
            y={M.t}
            width={Math.max(0, sx(clampX(b)) - sx(clampX(a)))}
            height={H - M.t - M.b}
          />
        ))}
        <line className="ax" x1={M.l} y1={H - M.b} x2={W - M.r} y2={H - M.b} />
        <line className="ax" x1={M.l} y1={M.t} x2={M.l} y2={H - M.b} />
        {niceTicks(x0, x1).map((t) => (
          <text key={`x${t}`} x={sx(t)} y={H - M.b + 16} textAnchor="middle">
            {fmtTick(t)}
          </text>
        ))}
        {niceTicks(y0, y1, 4).map((t) => (
          <text key={`y${t}`} x={M.l - 8} y={sy(t) + 4} textAnchor="end">
            {fmtTick(t)}
          </text>
        ))}
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
      </svg>
      {legend.length > 0 && <ChartLegend items={legend} />}
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
    <g className={tone}>
      {pts.map((p, i) => (
        <rect key={i} x={sx(p[0]) - DOT / 2} y={sy(p[1]) - DOT / 2} width={DOT} height={DOT} />
      ))}
    </g>
  );
}
