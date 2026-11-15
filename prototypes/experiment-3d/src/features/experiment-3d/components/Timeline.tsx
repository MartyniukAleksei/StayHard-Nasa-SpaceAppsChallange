import { useEffect, useMemo, useRef, useState } from "react";

import type { Experiment } from "../lib/experiment";
import { usePlayback, type Playback } from "../lib/playback";
import type { Track } from "../lib/series";

const H = 120;
const PAD = { l: 44, r: 44, t: 10, b: 20 };
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

/** Графік d²(t) і діаметрів полум'я з курсором часу. Клік або перетягування — перемотка. */
export function Timeline({ experiment, playback }: { experiment: Experiment; playback: Playback }) {
  const { t, playing, speed } = usePlayback(playback);
  const svg = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = svg.current!;
    const ro = new ResizeObserver(() => setW(Math.max(200, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { tMin, tMax } = experiment;
  const x = (v: number) => PAD.l + ((v - tMin) / (tMax - tMin)) * (W - PAD.l - PAD.r);

  const chart = useMemo(() => {
    const d = experiment.droplet.cols.d_mm;
    const d2s = Array.from(d, (v) => v * v);
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
    const yD2 = (v: number) => H - PAD.b - ((v - d2Min) / (d2Max - d2Min)) * (H - PAD.t - PAD.b);
    const yFlame = (v: number) => H - PAD.b - (v / flameMax) * (H - PAD.t - PAD.b);
    return {
      d2Min,
      d2Max,
      flameMax,
      d2: path(experiment.droplet, "d_mm", x, yD2, true),
      uv: path(experiment.flameUv, "flame_d_mm", x, yFlame),
      vis: path(experiment.flameColor, "flame_d_mm", x, yFlame),
    };
    // x залежить лише від experiment і W
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment, W]);

  const seekFromEvent = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    playback.seek(tMin + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (tMax - tMin));
  };

  // не більше ~12 позначок: крок 1, 2, 5, 10… секунд
  const tickStep = [1, 2, 5, 10, 20, 30, 60].find((s) => (tMax - tMin) / s <= 12) ?? 120;
  const ticks = [];
  for (let s = Math.ceil(tMin / tickStep) * tickStep; s <= tMax; s += tickStep) ticks.push(s);

  return (
    <div className="x3d-timeline">
      <div className="x3d-controls">
        <button className="x3d-play" onClick={() => playback.toggle()} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="x3d-speeds">
          {SPEEDS.map((s) => (
            <button key={s} className={s === speed ? "on" : ""} onClick={() => playback.setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>
      <svg
        ref={svg}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromEvent(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && seekFromEvent(e)}
      >
        {ticks.map((s) => (
          <g key={s}>
            <line x1={x(s)} x2={x(s)} y1={PAD.t} y2={H - PAD.b} className={s === 0 ? "tick zero" : "tick"} />
            <text x={x(s)} y={H - 5} textAnchor="middle">
              {s === 0 ? "ignition" : `${s} s`}
            </text>
          </g>
        ))}
        {experiment.flameEnd != null && (
          <g>
            <line x1={x(experiment.flameEnd)} x2={x(experiment.flameEnd)} y1={PAD.t} y2={H - PAD.b} className="tick end" />
            <text x={x(experiment.flameEnd) + 6} y={PAD.t + 10} className="end">
              flame out
            </text>
          </g>
        )}
        {(
          [
            [experiment.events.needlesRetract, "needles out"],
            [experiment.events.igniterOn, "igniter on"],
          ] as const
        ).map(
          ([at, label], k) =>
            at != null && (
              <g key={label}>
                <line x1={x(at)} x2={x(at)} y1={PAD.t} y2={H - PAD.b} className="tick event" />
                <text
                  x={x(at) + (x(at) < 150 ? 4 : -4)}
                  y={H - PAD.b - 6 - k * 11}
                  textAnchor={x(at) < 150 ? "start" : "end"}
                  className="event"
                >
                  {label}
                </text>
              </g>
            ),
        )}
        <path d={chart.uv} className="line uv" />
        <path d={chart.vis} className="line vis" />
        <path d={chart.d2} className="line d2" />
        <text x={4} y={PAD.t + 8} className="axis d2">
          {chart.d2Max.toFixed(1)} mm²
        </text>
        <text x={4} y={H - PAD.b} className="axis d2">
          {chart.d2Min.toFixed(1)}
        </text>
        <text x={W - 4} y={PAD.t + 8} textAnchor="end" className="axis">
          {chart.flameMax.toFixed(0)} mm
        </text>
        <text x={W - 4} y={H - PAD.b} textAnchor="end" className="axis">
          0
        </text>
        <line x1={x(t)} x2={x(t)} y1={2} y2={H - PAD.b + 4} className="cursor" />
      </svg>
      <div className="x3d-legend">
        <span className="d2">d² droplet</span>
        <span className="vis">flame ⌀ color</span>
        <span className="uv">flame ⌀ UV</span>
      </div>
    </div>
  );
}
