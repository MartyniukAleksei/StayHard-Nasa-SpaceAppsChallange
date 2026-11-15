import { useEffect, useMemo, useRef, useState } from "react";
import type { Experiment } from "../lib/experiment.ts";
import { usePlayback, type Playback } from "../lib/playback";

const H = 132;
const PAD = { l: 8, r: 8, t: 16, b: 22 };
export const SPEEDS = [1, 10, 60]; // the tests run for 10–50 minutes

/** P-Trak count and smoke mass over the whole test with the playback cursor. Click, drag or arrow keys seek. */
export function Timeline({ experiment: e, playback }: { experiment: Experiment; playback: Playback }) {
  const { t, playing, speed } = usePlayback(playback);
  const svg = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = svg.current!;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { tMin, tMax } = e;
  const x = (v: number) => PAD.l + ((v - tMin) / (tMax - tMin)) * (W - PAD.l - PAD.r);
  const plot = H - PAD.t - PAD.b;

  // each line is scaled to its own maximum in this test
  const paths = useMemo(() => {
    const line = (col: string) => {
      const v = e.hkp.cols[col];
      const top = v.reduce((m, a) => Math.max(m, a), 0) || 1;
      let d = "";
      for (let i = 0; i < v.length; i++) {
        d += `${i ? "L" : "M"}${x(e.hkp.t[i]).toFixed(1)},${(H - PAD.b - (v[i] / top) * plot).toFixed(1)}`;
      }
      return d;
    };
    return { ptrak: line("ptrak_per_cc"), mass: e.hasMass ? line("dusttrak_b_mg_m3") : "" };
    // x depends only on experiment and W
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e, W]);

  const seekFromEvent = (ev: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    playback.seek(tMin + ((ev.clientX - r.left - PAD.l) / (W - PAD.l - PAD.r)) * (tMax - tMin));
  };

  const maxTicks = W >= 560 ? 12 : 5;
  const tickStep = [10, 30, 60, 120, 300, 600, 1200].find((s) => (tMax - tMin) / s <= maxTicks) ?? 1800;
  const ticks = [];
  for (let s = Math.ceil(tMin / tickStep) * tickStep; s <= tMax; s += tickStep) ticks.push(s);

  const peak = e.ptrakPeak;
  return (
    <div className="s3d-timeline">
      <div className="s3d-controls">
        <button type="button" className="btn" onClick={() => playback.toggle()} aria-pressed={playing}>
          {playing ? "[ Pause ]" : "[ Play ]"}
        </button>
        <div className="s3d-speeds" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={s === speed ? "on" : undefined} aria-pressed={s === speed} onClick={() => playback.setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>
      <svg
        ref={svg}
        height={H}
        role="slider"
        tabIndex={0}
        aria-label={`Time in SAME-R test ${e.test.test_no}, seconds from heater on`}
        aria-valuemin={tMin}
        aria-valuemax={tMax}
        aria-valuenow={Math.round(t)}
        onPointerDown={(ev) => {
          ev.currentTarget.setPointerCapture(ev.pointerId);
          seekFromEvent(ev);
        }}
        onPointerMove={(ev) => ev.buttons === 1 && seekFromEvent(ev)}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowRight") playback.seek(playback.t + 5);
          else if (ev.key === "ArrowLeft") playback.seek(playback.t - 5);
          else if (ev.key === " ") playback.toggle();
          else return;
          ev.preventDefault();
        }}
      >
        {/* heater on: from the `heating` column */}
        {e.heaterOff != null && <rect x={x(0)} y={PAD.t} width={x(e.heaterOff) - x(0)} height={plot} className="heat" />}
        {ticks.map((s) => (
          <g key={s}>
            <line x1={x(s)} x2={x(s)} y1={PAD.t} y2={H - PAD.b} className={s === 0 ? "tick zero" : "tick"} />
            <text x={x(s)} y={H - 6} textAnchor={s === 0 ? "start" : "middle"}>
              {s === 0 ? "heater on" : `${s} s`}
            </text>
          </g>
        ))}
        {peak && (
          <g>
            <line x1={x(peak.t)} x2={x(peak.t)} y1={PAD.t} y2={H - PAD.b} className="tick event" />
            <text x={x(peak.t) + (x(peak.t) > W - 190 ? -4 : 4)} y={PAD.t - 4} textAnchor={x(peak.t) > W - 190 ? "end" : "start"}>
              P-Trak peak (derived) {peak.perCc >= 500000 ? "≥ " : ""}
              {peak.perCc.toLocaleString("en-US")} /cm³
            </text>
          </g>
        )}
        <path d={paths.mass} className="line mass" />
        <path d={paths.ptrak} className="line ptrak" />
        <text x={PAD.l + 4} y={PAD.t + 12} className="live">
          P-Trak count
        </text>
        {e.hasMass && (
          <text x={PAD.l + 4} y={PAD.t + 25} className="mass">
            smoke mass, max {e.massMax.toFixed(1)} mg/m³
          </text>
        )}
        <line x1={x(t)} x2={x(t)} y1={2} y2={H - PAD.b + 4} className="cursor" />
      </svg>
    </div>
  );
}
