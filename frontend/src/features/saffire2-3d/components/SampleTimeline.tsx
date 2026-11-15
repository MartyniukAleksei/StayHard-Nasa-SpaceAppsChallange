import { useEffect, useRef, useState } from "react";
import { usePlayback, type Playback } from "@/shared/three/playback";
import { niceTicks } from "@/shared/ui/chart/TimeChart";
import type { SaffireModel } from "../lib/model";

const H = 64;
const PAD = { l: 10, r: 10, t: 10, b: 20 };
const SPEEDS = [1, 5, 20];

/** One recording: igniter on (current > 0.5 A), flame (table burn time), seconds from ignition. */
export function SampleTimeline({ model, playback, id }: { model: SaffireModel; playback: Playback; id: string }) {
  const { t, playing, speed } = usePlayback(playback);
  const svg = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = svg.current!;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const seg = model.timeline.segments.find((s) => s.id === id)!;
  const s = model.samples.find((m) => m.id === id)!;
  const ign = seg.ignitionEpoch == null ? seg.p0 : seg.p0 + (seg.ignitionEpoch - seg.epochStart) / 1000;
  // axis in seconds from ignition
  const a0 = seg.p0 - ign;
  const a1 = seg.p1 - ign;
  const x = (v: number) => PAD.l + ((v - a0) / (a1 - a0)) * (W - PAD.l - PAD.r);
  const y0 = PAD.t;
  const y1 = H - PAD.b;
  const igOn = s.igniter ? s.igniter.t.filter((_, i) => (s.igniter!.v[i] ?? 0) > 0.5) : [];
  const burn = s.sample.burn_time_s;
  const burns = (s.burn.ugBurnCm ?? 0) > 0 && burn != null;

  const seek = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left - PAD.l) / (r.width - PAD.l - PAD.r);
    playback.seek(ign + a0 + f * (a1 - a0));
  };

  return (
    <div className="sf3d-timeline">
      <div className="sf3d-controls">
        <button type="button" className="btn" onClick={() => playback.toggle()}>
          {playing ? "Pause" : "Play"}
        </button>
        <div className="sf3d-speeds" role="group" aria-label="Playback speed">
          {SPEEDS.map((v) => (
            <button key={v} type="button" className={v === speed ? "on" : ""} aria-pressed={v === speed} onClick={() => playback.setSpeed(v)}>
              {v}×
            </button>
          ))}
        </div>
      </div>
      <svg
        ref={svg}
        height={H}
        role="slider"
        tabIndex={0}
        aria-label={`Time from ignition, sample ${id}`}
        aria-valuemin={Math.round(a0)}
        aria-valuemax={Math.round(a1)}
        aria-valuenow={Math.round(t - ign)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seek(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && seek(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") playback.seek(t + 5);
          if (e.key === "ArrowLeft") playback.seek(t - 5);
        }}
      >
        {niceTicks(a0, a1, 8).map((v) => (
          <g key={v}>
            <line className="tick" x1={x(v)} x2={x(v)} y1={y0} y2={y1} />
            <text x={x(v)} y={H - 6} textAnchor="middle">{v}</text>
          </g>
        ))}
        {burns && <rect className="flame" x={x(0)} y={y0 + 8} width={Math.max(1, x(burn!) - x(0))} height={y1 - y0 - 16} />}
        {igOn.length > 0 && <rect className="igniter" x={x(igOn[0])} y={y0 + 2} width={Math.max(2, x(igOn[igOn.length - 1]) - x(igOn[0]))} height={4} />}
        <line className="ign" x1={x(0)} x2={x(0)} y1={y0} y2={y1} />
        <text className="lbl" x={x(0) + 4} y={y0 + 8}>ignition</text>
        {burns && (
          <text className="lbl" x={Math.min(x(burn!) + 4, W - 70)} y={y0 + 8}>
            burn {burn} s
          </text>
        )}
        <line className="cursor" x1={x(t - ign)} x2={x(t - ign)} y1={2} y2={y1 + 2} />
      </svg>
    </div>
  );
}
