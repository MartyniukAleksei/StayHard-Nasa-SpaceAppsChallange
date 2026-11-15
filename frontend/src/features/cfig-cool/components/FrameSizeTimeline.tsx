import { useMemo } from "react";
import { useWidth } from "@/shared/lib/useWidth";
import { niceTicks } from "@/shared/ui/chart/TimeChart";
import type { ArchiveFrame, Frame } from "../frames";

const M = { l: 52, r: 16, t: 14, b: 40 };
const H = 190;
const LOG_LO = 4; // 10 KB
const LOG_HI = 7; // 10 MB

type Props = {
  archive: ArchiveFrame[];
  shown: Frame[];
  selected: number;
  onSelect: (i: number) => void;
};

/** All 72 frames of the test by size in the PSI archive. Uniform (fully saturated) frames compress to ~13 KB. */
export function FrameSizeTimeline({ archive, shown, selected, onSelect }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>(700, 300);
  const [t0, t1] = useMemo(() => [Math.min(...archive.map((a) => a.t_s)), Math.max(...archive.map((a) => a.t_s))], [archive]);
  const x = (t: number) => M.l + ((t - t0) / (t1 - t0)) * (W - M.l - M.r);
  const y = (b: number) => M.t + (1 - (Math.log10(b) - LOG_LO) / (LOG_HI - LOG_LO)) * (H - M.t - M.b);

  return (
    <div ref={ref} className="cf-tl chart">
      <svg width={W} height={H} role="group" aria-label="Size of each of the 72 frames in the PSI archive against time from ignition">
        {[4, 5, 6, 7].map((e) => (
          <g key={e}>
            <line className="grid" x1={M.l} x2={W - M.r} y1={y(10 ** e)} y2={y(10 ** e)} />
            <text x={M.l - 8} y={y(10 ** e) + 4} textAnchor="end">
              {e === 4 ? "10 KB" : e === 5 ? "100 KB" : e === 6 ? "1 MB" : "10 MB"}
            </text>
          </g>
        ))}
        {niceTicks(t0, t1, 6).map((t) => (
          <text key={t} x={x(t)} y={H - 20} textAnchor="middle">
            {t > 0 ? `+${t}` : t}
          </text>
        ))}
        <text x={W - M.r} y={H - 4} textAnchor="end" className="axlabel">
          time from ignition, s
        </text>
        <line className="cf-ign" x1={x(0)} x2={x(0)} y1={M.t} y2={H - M.b} />
        <text x={x(0) + 4} y={M.t + 10} className="cf-ign-label">
          ignition
        </text>
        {archive.map((a) => (
          <rect key={a.i} className="cf-archive-dot" x={x(a.t_s) - 1.5} y={y(a.compressed_bytes) - 1.5} width={3} height={3} />
        ))}
        {shown.map((f) => {
          const a = archive.find((r) => r.i === f.i);
          if (!a) return null;
          const on = f.i === selected;
          return (
            <g
              key={f.i}
              className={`cf-shown${on ? " on" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`Frame ${f.i} at ${f.t_s > 0 ? "+" : ""}${f.t_s} s`}
              aria-pressed={on}
              onClick={() => onSelect(f.i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(f.i);
                }
              }}
            >
              <circle cx={x(a.t_s)} cy={y(a.compressed_bytes)} r={11} className="cf-hit" />
              <circle cx={x(a.t_s)} cy={y(a.compressed_bytes)} r={on ? 6 : 4.5} className="cf-ring" />
            </g>
          );
        })}
      </svg>
      <ul className="chart-legend" aria-label="Legend">
        <li>
          <svg className="legend-swatch" width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
            <rect className="cf-archive-dot" x={7} y={3} width={4} height={4} />
          </svg>
          <span>every frame of the test ({archive.length}), archive metadata</span>
        </li>
        <li>
          <svg className="legend-swatch" width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
            <circle cx={9} cy={5} r={4.5} className="cf-ring" style={{ fill: "var(--void)", stroke: "var(--ink)", strokeWidth: 1.5 }} />
          </svg>
          <span>frames shown here</span>
        </li>
        <li>
          <svg className="legend-swatch" width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
            <circle cx={9} cy={5} r={4.5} style={{ fill: "var(--void)", stroke: "var(--flame)", strokeWidth: 2 }} />
          </svg>
          <span>selected</span>
        </li>
      </ul>
    </div>
  );
}
