import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Playback } from "@/shared/three/playback";
import type { SaffireModel } from "../lib/model";
import { ignitionPos } from "../lib/timeline";
import { CardFallback } from "./CardFallback";
import { Phase, Readouts } from "./Readouts";
import { hasWebGL, prefersReducedMotion, Scene, SceneBoundary, useSaffireModel } from "./shell";
import { Timeline } from "./Timeline";
import "./saffire2-3d.css";

/** 3D replay of the whole Saffire-II series (scene passport: docs/decisions/0011). */
/** `bare`: only the replay, for a host section that has its own heading. */
export function Saffire3D({ bare = false }: { bare?: boolean }) {
  const state = useSaffireModel();
  const webgl = useMemo(hasWebGL, []);

  let body: ReactNode;
  if (state.status === "error") body = <div className="sf3d-empty">3D replay unavailable: the sensor data did not load.</div>;
  else if (state.status === "pending") body = <div className="sf3d-empty">Loading the nine recordings…</div>;
  else if (state.status === "empty") body = <div className="sf3d-empty">No recordings with time stamps.</div>;
  else if (!webgl) body = <CardFallback samples={state.dash.samples} reason="This browser has no WebGL, so the 3D scene cannot be drawn." />;
  else
    body = (
      <SceneBoundary fallback={<CardFallback samples={state.dash.samples} reason="The 3D scene failed to start on this device." />}>
        <Replay model={state.model} />
      </SceneBoundary>
    );

  if (bare) return <div id="experiment-3d">{body}</div>;
  return (
    <section className="band" id="experiment-3d" aria-labelledby="sf3d-title">
      <div className="wrap">
        <h2 id="sf3d-title" className="h-section">The whole experiment in 3D</h2>
        <p className="lede">
          The flow duct aboard Cygnus with its card of nine samples. Play the series: each sample is lit in turn
          and its flame, igniter and burned length follow the flight data and the experiment table. Each sample also
          has its own 3D close-up on its sample page.
        </p>
        {body}
      </div>
    </section>
  );
}

function Replay({ model }: { model: SaffireModel }) {
  const reduced = useMemo(prefersReducedMotion, []);
  const playback = useMemo(() => {
    const p = new Playback(0, model.timeline.total, false, ignitionPos(model.timeline, "2-5"));
    p.speed = 20;
    return p;
  }, [model]);
  const [active, setActive] = useState(true);
  const [labels, setLabels] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const scaleBar = useRef<HTMLDivElement>(null);

  useEffect(() => playback.start(), [playback]);
  useOffscreenStop(root, playback, setActive);

  return (
    <div className="sf3d" ref={root}>
      <figure className="sf3d-stage">
        <Suspense fallback={<div className="sf3d-empty">Starting 3D…</div>}>
          <Scene model={model} playback={playback} active={active} reducedMotion={reduced} labels={labels} scaleBar={scaleBar} />
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
        <Timeline model={model} playback={playback} />
        <Readouts model={model} playback={playback} labels={labels} onLabels={setLabels} />
        <Note doi={model.doi} />
      </div>
    </div>
  );
}

/** Stop the clock and the renderer while the view is offscreen. */
export function useOffscreenStop(root: React.RefObject<HTMLDivElement | null>, playback: Playback, setActive: (v: boolean) => void) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      playback.active = entry.isIntersecting;
      setActive(entry.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [root, playback, setActive]);
}

export function Note({ doi, sample }: { doi: string; sample?: string }) {
  return (
    <p className="sf3d-note">
      3D replay drawn from flight data and the experiment table, not a recording · Saffire-II (PSI-99, doi:{doi})
      {sample ? ` · sample ${sample}` : ""}. From the data: which sample is recorded, igniter on/off (igniter current),
      flame duration (table burn time), burned length after each test (table), flame brightness (radiometers), flow
      speed (anemometer), module CO₂. Estimate: the flame front moves at the table spread rate (SIBAL) or evenly over
      the burn time (PMMA strip of 2-7); thick PMMA keeps its flame at the base (Note 4) while the damaged zone grows
      evenly to its table length. To scale: samples 5 × 29 cm on a 3 × 3 card (Readme, Fig. 1); the module about 53 ×
      90 × 133 cm (Objectives, Development and Status, Fig. 1). Schematic: spacing on the card, fans, flow
      straighteners, avionics bay, cameras. Illustrative: colours, flame shape and flicker; particles move at the
      measured flow speed in real time, not at playback speed.{sample ? "" : " Long pauses between recordings are shortened."}{" "}
      Drag to rotate, scroll to zoom.
    </p>
  );
}
