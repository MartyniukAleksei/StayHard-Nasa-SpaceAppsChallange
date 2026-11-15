import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Playback } from "@/shared/three/playback";
import type { ClockMode, SaffireModel } from "../lib/model";
import { ignitionPos } from "../lib/timeline";
import { AlignedPhase, AlignedReadouts, AlignedTimeline } from "./AlignedHud";
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
          The flow duct aboard Cygnus with its card of nine samples. Side by side, all nine are lit together at their
          own ignition so they can be compared; as flown, each is lit in turn. Flame, igniter and burned length follow
          the flight data and the experiment table. Each sample also has its own 3D close-up on its sample page.
        </p>
        {body}
      </div>
    </section>
  );
}

const MODES: { id: ClockMode; label: string }[] = [
  { id: "aligned", label: "Side by side" },
  { id: "series", label: "As flown" },
];

function Replay({ model }: { model: SaffireModel }) {
  const reduced = useMemo(prefersReducedMotion, []);
  const [mode, setMode] = useState<ClockMode>("aligned");
  const playback = useMemo(() => {
    if (mode === "aligned") {
      const p = new Playback(model.aligned.tMin, model.aligned.tMax, !reduced, Math.max(model.aligned.tMin, -3));
      p.speed = 5;
      return p;
    }
    const p = new Playback(0, model.timeline.total, false, ignitionPos(model.timeline, "2-5"));
    p.speed = 20;
    return p;
  }, [model, mode, reduced]);
  const [active, setActive] = useState(true);
  const [labels, setLabels] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const scaleBar = useRef<HTMLDivElement>(null);

  useEffect(() => playback.start(), [playback]);
  useOffscreenStop(root, playback, setActive);

  return (
    <div className="sf3d" ref={root}>
      <div className="sf3d-modes" role="group" aria-label="How the nine samples are shown">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={m.id === mode ? "on" : ""} aria-pressed={m.id === mode} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
        <span className="sf3d-modes-note mono">
          {mode === "aligned"
            ? "all nine from their own ignition; in flight they burned one after another"
            : "one recording after another, as on board; long pauses shortened"}
        </span>
      </div>
      <figure className="sf3d-stage">
        <Suspense fallback={<div className="sf3d-empty">Starting 3D…</div>}>
          <Scene key={mode} model={model} playback={playback} active={active} reducedMotion={reduced} labels={labels} scaleBar={scaleBar} mode={mode} />
        </Suspense>
        <div className="sf3d-scale mono" aria-hidden="true">
          <div ref={scaleBar} />
          10 cm at the card
        </div>
        <figcaption className="sf3d-phase mono">
          {mode === "aligned" ? <AlignedPhase model={model} playback={playback} /> : <Phase model={model} playback={playback} />}
        </figcaption>
      </figure>
      <div className="sf3d-under">
        {mode === "aligned" ? (
          <>
            <AlignedTimeline model={model} playback={playback} />
            <AlignedReadouts model={model} playback={playback} labels={labels} onLabels={setLabels} />
          </>
        ) : (
          <>
            <Timeline model={model} playback={playback} />
            <Readouts model={model} playback={playback} labels={labels} onLabels={setLabels} />
          </>
        )}
        <Note doi={model.doi} aligned={mode === "aligned"} />
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

export function Note({ doi, sample, aligned = false }: { doi: string; sample?: string; aligned?: boolean }) {
  return (
    <p className="sf3d-note">
      3D replay drawn from flight data and the experiment table, not a recording · Saffire-II (PSI-99, doi:{doi})
      {sample ? ` · sample ${sample}` : ""}.
      {aligned
        ? " Side by side: every recording is shifted so its ignition is at 0 s; in flight the samples burned one after another over about an hour."
        : ""}{" "}
      From the data: which sample is recorded, igniter on/off (igniter current),
      flame duration (table burn time), burned length after each test (table), flame brightness (radiometers), flow
      speed (anemometer), module CO₂. Estimate: the flame front moves at the table spread rate (SIBAL) or evenly over
      the burn time (PMMA strip of 2-7); thick PMMA keeps its flame at the base (Note 4) while the damaged zone grows
      evenly to its table length. To scale: samples 5 × 29 cm on a 3 × 3 card (Readme, Fig. 1); the module about 53 ×
      90 × 133 cm (Objectives, Development and Status, Fig. 1). Schematic: spacing on the card, fans, flow
      straighteners, avionics bay, cameras. Illustrative: colours, flame shape and flicker, sparks and the glowing
      burn edge; particles move at the measured flow speed in real time, not at playback speed
      {aligned ? " (side by side: the mean of the recordings running at that moment)" : ""}.{sample || aligned ? "" : " Long pauses between recordings are shortened."}{" "}
      Drag to rotate, scroll to zoom.
    </p>
  );
}
