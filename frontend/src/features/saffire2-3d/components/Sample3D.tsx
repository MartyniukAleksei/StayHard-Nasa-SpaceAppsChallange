import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Playback } from "@/shared/three/playback";
import type { SaffireModel } from "../lib/model";
import { ignitionPos } from "../lib/timeline";
import { Phase, Readouts } from "./Readouts";
import { Note, useOffscreenStop } from "./Saffire3D";
import { SampleTimeline } from "./SampleTimeline";
import { hasWebGL, prefersReducedMotion, Scene, SceneBoundary, useSaffireModel } from "./shell";
import "./saffire2-3d.css";

/**
 * 3D close-up of one sample: its own recording only (from −60 s to the end), the camera on that
 * strip. `onT` reports seconds from ignition so the charts below can follow the scene.
 */
export function Sample3D({ id, onT }: { id: string; onT?: (t: number | null) => void }) {
  const state = useSaffireModel();
  const webgl = useMemo(hasWebGL, []);
  if (state.status === "pending") return <div className="sf3d-empty">Loading sensors…</div>;
  if (state.status !== "ready") return <div className="sf3d-empty">3D view unavailable for {id}.</div>;
  if (!webgl) return <div className="sf3d-empty">This browser has no WebGL, so the 3D view cannot be drawn.</div>;
  if (!state.model.timeline.segments.some((s) => s.id === id)) return <div className="sf3d-empty">No recording for {id}.</div>;
  return (
    <SceneBoundary fallback={<div className="sf3d-empty">The 3D view failed to start on this device.</div>}>
      <SampleReplay model={state.model} id={id} onT={onT} />
    </SceneBoundary>
  );
}

function SampleReplay({ model, id, onT }: { model: SaffireModel; id: string; onT?: (t: number | null) => void }) {
  const reduced = useMemo(prefersReducedMotion, []);
  const seg = model.timeline.segments.find((s) => s.id === id)!;
  const playback = useMemo(() => {
    const p = new Playback(seg.p0, seg.p1, false, ignitionPos(model.timeline, id));
    p.speed = 5;
    return p;
  }, [model, seg, id]);
  const [active, setActive] = useState(true);
  const [labels, setLabels] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const scaleBar = useRef<HTMLDivElement>(null);

  useEffect(() => playback.start(), [playback]);
  useOffscreenStop(root, playback, setActive);

  // report the time from ignition to the charts, at most ~6 times a second
  useEffect(() => {
    if (!onT || seg.ignitionEpoch == null) return;
    const ign = seg.p0 + (seg.ignitionEpoch - seg.epochStart) / 1000;
    let last = 0;
    let sent: number | null = null;
    const push = () => {
      const now = performance.now();
      if (now - last < 160) return;
      last = now;
      const t = Math.round((playback.t - ign) * 10) / 10;
      if (t !== sent) onT((sent = t));
    };
    push();
    const unsubscribe = playback.subscribe(push);
    return () => {
      unsubscribe();
    };
  }, [playback, seg, onT]);

  return (
    <div className="sf3d sf3d-one" ref={root}>
      <figure className="sf3d-stage">
        <Suspense fallback={<div className="sf3d-empty">Starting 3D…</div>}>
          <Scene model={model} playback={playback} active={active} reducedMotion={reduced} labels={labels} scaleBar={scaleBar} focusId={id} />
        </Suspense>
        <div className="sf3d-scale mono" aria-hidden="true">
          <div ref={scaleBar} />
          10 cm at the card
        </div>
        <figcaption className="sf3d-phase mono">
          <Phase model={model} playback={playback} />
        </figcaption>
      </figure>
      <div className="sf3d-under">
        <SampleTimeline model={model} playback={playback} id={id} />
        <Readouts model={model} playback={playback} labels={labels} onLabels={setLabels} />
        <Note doi={model.doi} sample={id} />
      </div>
    </div>
  );
}
