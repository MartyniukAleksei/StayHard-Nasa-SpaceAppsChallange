import { useEffect, useRef, useState } from "react";
import { usePlayback, type Playback } from "@/shared/three/playback";
import type { SaffireModel } from "../lib/model";
import { ignitionPos } from "../lib/timeline";

const H = 70;
const PAD = { l: 8, r: 8, t: 16, b: 22 };
const SPEEDS = [5, 20, 60];

/** The whole series: nine recordings, flame periods (table burn time), squeezed pauses. */
export function Timeline({ model, playback }: { model: SaffireModel; playback: Playback }) {
  const { t, playing, speed } = usePlayback(playback);
  const svg = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = svg.current!;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tl = model.timeline;
  const x = (p: number) => PAD.l + (p / tl.total) * (W - PAD.l - PAD.r);
  const y0 = PAD.t;
  const y1 = H - PAD.b;

  const seekFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left - PAD.l) / (r.width - PAD.l - PAD.r);
    playback.seek(f * tl.total);
  };

  return (
    <div className="sf3d-timeline">
      <div className="sf3d-controls">
        <button type="button" className="btn" onClick={() => playback.toggle()}>
          {playing ? "Pause" : "Play"}
        </button>
        <div className="sf3d-speeds" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={s === speed ? "on" : ""} aria-pressed={s === speed} onClick={() => playback.setSpeed(s)}>
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
        aria-label="Position in the Saffire-II series"
        aria-valuemin={0}
        aria-valuemax={Math.round(tl.total)}
        aria-valuenow={Math.round(t)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromEvent(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && seekFromEvent(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") playback.seek(t + 10);
          if (e.key === "ArrowLeft") playback.seek(t - 10);
        }}
      >
        {tl.segments.map((s) => {
          const sample = model.samples.find((m) => m.id === s.id);
          const ign = s.ignitionEpoch == null ? null : s.p0 + (s.ignitionEpoch - s.epochStart) / 1000;
          const burn = sample?.sample.burn_time_s ?? null;
          return (
            <g key={s.id}>
              <rect className="seg" x={x(s.p0)} y={y0} width={Math.max(1, x(s.p1) - x(s.p0))} height={y1 - y0} />
              {ign != null && burn != null && (sample?.burn.ugBurnCm ?? 0) > 0 && (
                <rect className="flame" x={x(ign)} y={y0 + 6} width={Math.max(1, x(ign + burn) - x(ign))} height={y1 - y0 - 12} />
              )}
              {ign != null && <line className="ign" x1={x(ign)} x2={x(ign)} y1={y0} y2={y1} />}
              <text x={(x(s.p0) + x(s.p1)) / 2} y={H - 6} textAnchor="middle">
                {s.id}
              </text>
            </g>
          );
        })}
        {tl.gaps
          .filter((g) => g.realS > 60)
          .map((g) => (
            <text key={g.p0} className="gap" x={(x(g.p0) + x(g.p1)) / 2} y={y0 - 4} textAnchor="middle">
              ⋯{Math.round(g.realS / 60)} min
            </text>
          ))}
        <line className="cursor" x1={x(t)} x2={x(t)} y1={4} y2={y1 + 2} />
      </svg>
      <div className="sf3d-jump" role="group" aria-label="Jump to a sample">
        {model.samples.map((s) => (
          <button key={s.id} type="button" className="tag" onClick={() => playback.seek(ignitionPos(tl, s.id))}>
            {s.id}
          </button>
        ))}
      </div>
    </div>
  );
}
