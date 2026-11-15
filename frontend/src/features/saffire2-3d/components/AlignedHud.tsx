import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayback, type Playback } from "@/shared/three/playback";
import { stateAligned, valueAt, type SaffireModel, type SceneSample } from "../lib/model";

const ROW = 13;
const PAD = { l: 34, r: 10, t: 6, b: 20 };
const SPEEDS = [5, 20, 60];
const signed = (t: number) => `${t >= 0 ? "+" : "−"}${Math.abs(t).toFixed(1)} s`;

/** Igniter on/off from the igniter current (data), seconds from ignition. */
function igniterSpan(s: SceneSample): [number, number] | null {
  const tr = s.igniter;
  if (!tr) return null;
  let a: number | null = null;
  let b: number | null = null;
  tr.t.forEach((t, i) => {
    const v = tr.v[i];
    if (v != null && v > 0.5) {
      if (a == null) a = t;
      b = t;
    }
  });
  return a != null && b != null ? [a, b] : null;
}

/** Side by side: nine rows on one axis of seconds from ignition; recording, igniter and flame per sample. */
export function AlignedTimeline({ model, playback }: { model: SaffireModel; playback: Playback }) {
  const { t, playing, speed } = usePlayback(playback);
  const svg = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = svg.current!;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { tMin, tMax, windows } = model.aligned;
  const H = PAD.t + ROW * model.samples.length + PAD.b;
  const x = (v: number) => PAD.l + ((v - tMin) / (tMax - tMin || 1)) * (W - PAD.l - PAD.r);
  const spans = useMemo(() => new Map(model.samples.map((s) => [s.id, igniterSpan(s)])), [model]);
  const ticks = useMemo(() => {
    const step = tMax - tMin > 900 ? 200 : 100;
    const out: number[] = [];
    for (let v = Math.ceil(tMin / step) * step; v <= tMax; v += step) out.push(v);
    return out;
  }, [tMin, tMax]);

  const seekFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left - PAD.l) / (r.width - PAD.l - PAD.r);
    playback.seek(tMin + f * (tMax - tMin));
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
        aria-label="Seconds from ignition, all samples aligned"
        aria-valuemin={Math.round(tMin)}
        aria-valuemax={Math.round(tMax)}
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
        {ticks.map((v) => (
          <g key={v}>
            <line className="tick" x1={x(v)} x2={x(v)} y1={PAD.t} y2={H - PAD.b} />
            <text className="lbl" x={x(v)} y={H - 6} textAnchor="middle">
              {v === 0 ? "ignition" : `${v} s`}
            </text>
          </g>
        ))}
        {model.samples.map((s, i) => {
          const w = windows.find((x) => x.id === s.id);
          const y = PAD.t + i * ROW;
          const burn = s.sample.burn_time_s;
          const ign = spans.get(s.id);
          return (
            <g key={s.id}>
              <text className="lbl" x={4} y={y + ROW - 3}>
                {s.id}
              </text>
              {w && <rect className="seg" x={x(w.from)} y={y + 2} width={Math.max(1, x(w.to) - x(w.from))} height={ROW - 4} />}
              {burn != null && (s.burn.ugBurnCm ?? 0) > 0 && (
                <rect className="flame" x={x(0)} y={y + 4} width={Math.max(1, x(burn) - x(0))} height={ROW - 8} />
              )}
              {ign && <rect className="igniter" x={x(ign[0])} y={y + 4} width={Math.max(2, x(ign[1]) - x(ign[0]))} height={ROW - 8} />}
            </g>
          );
        })}
        <line className="ign" x1={x(0)} x2={x(0)} y1={PAD.t} y2={H - PAD.b} />
        <line className="cursor" x1={x(t)} x2={x(t)} y1={2} y2={H - PAD.b + 2} />
      </svg>
      <p className="sf3d-legend mono">
        <i className="k-seg" /> recording <i className="k-ign" /> igniter on (current) <i className="k-flame" /> flame (table burn time)
      </p>
    </div>
  );
}

/** One line under the scene: which strips burn now, side by side. */
export function AlignedPhase({ model, playback }: { model: SaffireModel; playback: Playback }) {
  usePlayback(playback);
  const now = stateAligned(model, playback.t);
  const ids = (f: (x: (typeof now)[number]) => boolean) => now.filter(f).map((x) => x.s.id);
  const ign = ids((x) => x.igniterOn);
  const flame = ids((x) => x.burn.flame);
  return (
    <>
      Aligned at ignition · {signed(playback.t)} ·{" "}
      {ign.length > 0 && <span className="sf3d-live">igniter on: {ign.join(", ")} · </span>}
      {flame.length > 0 ? <span className="sf3d-live">flame: {flame.join(", ")}</span> : ign.length > 0 ? null : playback.t < 0 ? "waiting for ignition" : "no flame"}
    </>
  );
}

export function AlignedReadouts({ model, playback, labels, onLabels }: { model: SaffireModel; playback: Playback; labels: boolean; onLabels: (v: boolean) => void }) {
  usePlayback(playback);
  const now = stateAligned(model, playback.t);
  const flows = now.filter((x) => x.active && x.tIgn != null).map((x) => valueAt(x.s.flow, x.tIgn!)).filter((v): v is number => v != null);
  const flow = flows.length ? flows.reduce((a, b) => a + b, 0) / flows.length : null;
  const recording = now.filter((x) => x.active).length;
  const burning = now.filter((x) => x.burn.flame).length;
  const done = now.filter((x) => x.tIgn === Infinity && x.burn.burned > 0).length;
  return (
    <div className="sf3d-readout mono">
      <span>recordings running: {recording} of {now.length}</span>
      <span>flames now: {burning}</span>
      <span>flow {flow == null ? "no data" : `${flow.toFixed(1)} cm/s`} (mean of the running recordings, derived)</span>
      <span>finished with burn damage: {done}</span>
      <label className="sf3d-toggle">
        <input type="checkbox" checked={labels} onChange={(e) => onLabels(e.target.checked)} /> labels
      </label>
    </div>
  );
}
