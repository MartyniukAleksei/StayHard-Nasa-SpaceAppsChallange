import { useWidth } from "@/shared/lib/useWidth";
import "./chart.css";

// SVG chart in the StayHard style: measurements are raster dots, models thin lines,
// events blue marks, labels sit next to the series instead of a legend.

export type Tone = "ink" | "ash" | "flame" | "ext" | "dis" | "com" | "s1" | "s2";
export type Point = [x: number, y: number];
export type Series = {
  id: string;
  label?: string;
  points: Point[];
  kind?: "dots" | "line";
  tone?: Tone;
};
export type Marker = { x: number; label: string };

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
};

const M = { l: 48, r: 72, t: 14, b: 36 };
const DOT = 2;

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

export function TimeChart(props: Props) {
  const { series, xLabel, yLabel, ariaLabel, height = 220, cursor, markers = [] } = props;
  const [ref, W] = useWidth<HTMLDivElement>();
  const [ex0, ex1] = extent(series, 0);
  const [, ey1] = extent(series, 1);
  const [x0, x1] = props.xDomain ?? [Math.min(0, ex0), ex1 || 1];
  const [y0, y1] = props.yDomain ?? [0, (ey1 || 1) * 1.05];
  const H = height;
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  const inX = (v: number) => v >= x0 && v <= x1;

  return (
    <div ref={ref} className="tchart">
      <svg width={W} height={H} role="img" aria-label={ariaLabel}>
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
        <text x={M.l} y={M.t - 2} className="axlabel">
          {yLabel}
        </text>
        {series.map((s) => (
          <SeriesMarks key={s.id} s={s} sx={sx} sy={sy} inX={inX} />
        ))}
        {markers.filter((m) => inX(m.x)).map((m) => (
          <g key={m.label} className="marker">
            <line x1={sx(m.x)} y1={M.t} x2={sx(m.x)} y2={H - M.b} />
            <text x={sx(m.x) + 6} y={M.t + 10}>
              {m.label}
            </text>
          </g>
        ))}
        {cursor != null && inX(cursor) && (
          <line className="cursor" x1={sx(cursor)} y1={M.t} x2={sx(cursor)} y2={H - M.b} />
        )}
      </svg>
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
  const last = pts[pts.length - 1];
  return (
    <g className={tone}>
      {s.kind === "line" ? (
        <polyline points={pts.map((p) => `${sx(p[0])},${sy(p[1])}`).join(" ")} />
      ) : (
        pts.map((p, i) => (
          <rect key={i} x={sx(p[0]) - DOT / 2} y={sy(p[1]) - DOT / 2} width={DOT} height={DOT} />
        ))
      )}
      {s.label && (
        <text x={sx(last[0]) + 6} y={sy(last[1]) + 4} className="slabel">
          {s.label}
        </text>
      )}
    </g>
  );
}
