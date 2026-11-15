import { useEffect, useMemo, useRef, useState } from "react";
import type { Experiment } from "../lib/experiment";
import { usePlayback, type Playback } from "../lib/playback";
import type { Track } from "../lib/series";

const H = 132;
const PAD = { l: 48, r: 44, t: 14, b: 22 };
const SPEEDS = [0.25, 0.5, 1];

function path(track: Track | null, col: string, x: (t: number) => number, y: (v: number) => number, sq = false) {
  if (!track) return "";
  const v = track.cols[col];
  let d = "";
  for (let i = 0; i < track.t.length; i++) {
    d += `${i ? "L" : "M"}${x(track.t[i]).toFixed(1)},${y(sq ? v[i] * v[i] : v[i]).toFixed(1)}`;
  }
  return d;
}

/** d²(t) and flame diameters with the playback cursor. Click, drag or arrow keys seek. */
export function Timeline({ experiment, playback }: { experiment: Experiment; playback: Playback }) {
  const { t, playing, speed } = usePlayback(playback);
  const svg = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = svg.current!;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { tMin, tMax } = experiment;
  const x = (v: number) => PAD.l + ((v - tMin) / (tMax - tMin)) * (W - PAD.l - PAD.r);

  const chart = useMemo(() => {
    const d2s = Array.from(experiment.droplet.cols.d_mm, (v) => v * v);
    const d2Hi = Math.max(...d2s);
    const d2Lo = Math.min(...d2s);
    const pad = (d2Hi - d2Lo) * 0.15 || 1;
    const d2Min = Math.max(0, d2Lo - pad);
    const d2Max = d2Hi + pad;
    const flameMax =
      Math.max(
        1,
        ...Array.from(experiment.flameUv?.cols.flame_d_mm ?? []),
        ...Array.from(experiment.flameColor?.cols.flame_d_mm ?? []),
      ) * 1.08;
    const plot = H - PAD.t - PAD.b;
    const yD2 = (v: number) => H - PAD.b - ((v - d2Min) / (d2Max - d2Min)) * plot;
    const yFlame = (v: number) => H - PAD.b - (v / flameMax) * plot;
    // where to put a line's label: a point at the given share of the series
    const labelAt = (track: Track | null, col: string, y: (v: number) => number, share: number, sq = false) => {
      if (!track) return null;
      const i = Math.round((track.t.length - 1) * share);
      const v = track.cols[col][i];
      return { x: x(track.t[i]), y: y(sq ? v * v : v) };
    };
    return {
      d2Min,
      d2Max,
      flameMax,
      d2: path(experiment.droplet, "d_mm", x, yD2, true),
      uv: path(experiment.flameUv, "flame_d_mm", x, yFlame),
      vis: path(experiment.flameColor, "flame_d_mm", x, yFlame),
      d2At: labelAt(experiment.droplet, "d_mm", yD2, 0.8, true),
      uvAt: labelAt(experiment.flameUv, "flame_d_mm", yFlame, 0.55),
      visAt: labelAt(experiment.flameColor, "flame_d_mm", yFlame, 0.3),
    };
    // x depends only on experiment and W
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment, W]);

  const wide = W >= 560; // on a narrow chart the line labels would overlap

  const seekFromEvent = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    playback.seek(tMin + ((e.clientX - r.left - PAD.l) / (W - PAD.l - PAD.r)) * (tMax - tMin));
  };

  // at most ~12 ticks: every 1, 2, 5, 10… seconds
  const tickStep = [1, 2, 5, 10, 20, 30, 60].find((s) => (tMax - tMin) / s <= 12) ?? 120;
  const ticks = [];
  for (let s = Math.ceil(tMin / tickStep) * tickStep; s <= tMax; s += tickStep) ticks.push(s);

  const events = (
    [
      [experiment.events.needlesRetract, "needles out"],
      [experiment.events.igniterOn, "igniter on"],
    ] as const
  ).filter((e): e is readonly [number, "needles out" | "igniter on"] => e[0] != null);

  return (
    <div className="x3d-timeline">
      <div className="x3d-controls">
        <button type="button" className="btn ghost" onClick={() => playback.toggle()} aria-pressed={playing}>
          {playing ? "Pause" : "Play"}
        </button>
        <div className="x3d-speeds" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={s === speed ? "on" : undefined}
              aria-pressed={s === speed}
              onClick={() => playback.setSpeed(s)}
            >
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
        aria-label={`Time in test ${experiment.test.test_no}, seconds from ignition`}
        aria-valuemin={Number(tMin.toFixed(1))}
        aria-valuemax={Number(tMax.toFixed(1))}
        aria-valuenow={Number(t.toFixed(1))}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromEvent(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && seekFromEvent(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") playback.seek(playback.t + 0.1);
          else if (e.key === "ArrowLeft") playback.seek(playback.t - 0.1);
          else if (e.key === " ") playback.toggle();
          else return;
          e.preventDefault();
        }}
      >
        {ticks.map((s) => (
          <g key={s}>
            <line x1={x(s)} x2={x(s)} y1={PAD.t} y2={H - PAD.b} className={s === 0 ? "tick zero" : "tick"} />
            <text x={x(s)} y={H - 6} textAnchor="middle">
              {s === 0 ? "ignition" : `${s} s`}
            </text>
          </g>
        ))}
        {events.map(([at, label], k) => (
          <g key={label}>
            <line x1={x(at)} x2={x(at)} y1={PAD.t} y2={H - PAD.b} className="tick event" />
            <text x={x(at) + (x(at) < 150 ? 4 : -4)} y={H - PAD.b - 5 - k * 12} textAnchor={x(at) < 150 ? "start" : "end"}>
              {label}
            </text>
          </g>
        ))}
        {experiment.flameEnd != null && (
          <g>
            <line x1={x(experiment.flameEnd)} x2={x(experiment.flameEnd)} y1={PAD.t} y2={H - PAD.b} className="tick end" />
            <text x={x(experiment.flameEnd) + 5} y={H - PAD.b - 5} className="live">
              flame out
            </text>
          </g>
        )}
        <path d={chart.uv} className="line uv" />
        <path d={chart.vis} className="line vis" />
        <path d={chart.d2} className="line d2" />
        {/* labels next to the lines instead of a legend */}
        {wide && chart.d2At && (
          <text x={chart.d2At.x} y={chart.d2At.y + 15} textAnchor="middle" className="ink">
            d² droplet
          </text>
        )}
        {wide && chart.uvAt && (
          <text x={chart.uvAt.x} y={chart.uvAt.y - 7} textAnchor="middle" className="uv">
            flame ⌀ UV
          </text>
        )}
        {wide && chart.visAt && (
          <text x={chart.visAt.x} y={chart.visAt.y + 15} textAnchor="middle" className="live">
            flame ⌀ color
          </text>
        )}
        <text x={2} y={PAD.t + 4} className="ink">
          {chart.d2Max.toFixed(1)} mm²
        </text>
        <text x={2} y={H - PAD.b} className="ink">
          {chart.d2Min.toFixed(1)}
        </text>
        <text x={W - 2} y={PAD.t + 4} textAnchor="end" className="live">
          {chart.flameMax.toFixed(0)} mm
        </text>
        <text x={W - 2} y={H - PAD.b} textAnchor="end" className="live">
          0
        </text>
        <line x1={x(t)} x2={x(t)} y1={2} y2={H - PAD.b + 4} className="cursor" />
      </svg>
    </div>
  );
}
