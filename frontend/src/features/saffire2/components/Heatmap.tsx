import { niceTicks } from "@/shared/ui/chart/TimeChart";
import { useWidth } from "@/shared/lib/useWidth";
import { heatGrid, level, type Num } from "../lib/series";

const STEPS = 6;
const OPACITY = [0.05, 0.16, 0.3, 0.48, 0.7, 1];

/** B2: thermocouple × time heat map; the flame front shows as a diagonal track. */
export function Heatmap({ t, rows, labels, unit, cursor }: { t: number[]; rows: Num[][]; labels: string[]; unit: string; cursor?: number | null }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const L = 52;
  const R = 8;
  const rowH = 22;
  const H = rows.length * rowH + 34;
  const bins = Math.max(30, Math.min(180, Math.floor((W - L - R) / 4)));
  const range: [number, number] = [t[0] ?? 0, t[t.length - 1] ?? 1];
  const { grid, lo, hi } = heatGrid(t, rows, bins, range);
  const cw = (W - L - R) / bins;
  const sx = (v: number) => L + ((v - range[0]) / (range[1] - range[0] || 1)) * (W - L - R);
  return (
    <div>
      <div ref={ref} className="sf-svg">
        <svg width={W} height={H} role="img" aria-label={`Heat map of ${labels.length} thermocouples over time`}>
          {grid.map((row, k) => (
            <g key={labels[k]}>
              <text x={0} y={k * rowH + rowH / 2 + 4} className="sf-rowlabel">{labels[k]}</text>
              {row.map((v, b) =>
                v == null ? null : (
                  <rect
                    key={b}
                    x={L + b * cw}
                    y={k * rowH + 1}
                    width={Math.max(1, cw - 0.5)}
                    height={rowH - 2}
                    className="sf-cell"
                    fillOpacity={OPACITY[level(v, lo, hi, STEPS)]}
                  />
                ),
              )}
            </g>
          ))}
          {niceTicks(range[0], range[1], 6).map((x) => (
            <text key={x} x={sx(x)} y={H - 10} textAnchor="middle">{x}</text>
          ))}
          {range[0] < 0 && <line className="sf-ign" x1={sx(0)} x2={sx(0)} y1={0} y2={rows.length * rowH} />}
          {cursor != null && cursor >= range[0] && cursor <= range[1] && (
            <line className="sf-cursor" x1={sx(cursor)} x2={sx(cursor)} y1={0} y2={rows.length * rowH} />
          )}
        </svg>
      </div>
      <p className="muted small sf-scale">
        <span className="mono">{lo.toFixed(0)} {unit}</span>
        {OPACITY.map((o) => (
          <i key={o} style={{ opacity: o }} aria-hidden="true" />
        ))}
        <span className="mono">{hi.toFixed(0)} {unit}</span>
        <span>· s from ignition (blue line) · scale per sample</span>
      </p>
    </div>
  );
}
