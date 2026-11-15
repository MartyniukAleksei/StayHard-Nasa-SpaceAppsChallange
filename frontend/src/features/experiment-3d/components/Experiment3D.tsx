import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DropletReplay } from "@/features/replay";
import { useExperiment } from "../api";
import type { Experiment } from "../lib/experiment";
import { Playback } from "../lib/playback";
import { FramesPanel } from "./FramesPanel";
import { Phase, Readouts } from "./Readouts";
import type { Layers } from "./Scene";
import { Timeline } from "./Timeline";
import "./experiment-3d.css";

// three.js is a separate chunk: it loads only when the 3D replay is opened
const Scene = lazy(() => import("./Scene").then((m) => ({ default: m.Scene })));

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** 3D replay of one FLEX test, drawn from its measured series, next to the real onboard frames. */
/** startAt: open paused at this moment (s after ignition), e.g. from ?t= in the URL. */
export function Experiment3D({ testNo, startAt }: { testNo: number; startAt?: number }) {
  const state = useExperiment(testNo);
  const webgl = useMemo(hasWebGL, []);

  if (!webgl) return <Fallback testNo={testNo} reason="This browser has no WebGL, so the 3D scene cannot be drawn." />;
  if (state.status === "pending") return <div className="x3d-empty">Loading measured series…</div>;
  if (state.status === "error") return <div className="x3d-empty">3D replay unavailable ({state.message}).</div>;
  if (state.status === "empty") return <div className="x3d-empty">No droplet series for test #{testNo}.</div>;
  return (
    <SceneBoundary fallback={<Fallback testNo={testNo} reason="The 3D scene failed to start on this device." />}>
      <Replay experiment={state.experiment} startAt={startAt} />
    </SceneBoundary>
  );
}

function Fallback({ testNo, reason }: { testNo: number; reason: string }) {
  return (
    <div className="x3d-fallback">
      <p className="x3d-note">{reason} Showing the 2D replay from the same data instead.</p>
      <DropletReplay testNo={testNo} />
    </div>
  );
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Replay({ experiment, startAt }: { experiment: Experiment; startAt?: number }) {
  const reduced = useMemo(prefersReducedMotion, []);
  // with reduced motion: paused on a frame that already shows the flame
  const playback = useMemo(
    () =>
      startAt != null
        ? new Playback(experiment.tMin, experiment.tMax, false, startAt) // a chosen moment: paused on it
        : new Playback(experiment.tMin, experiment.tMax, !reduced, reduced ? Math.min(2, experiment.tMax) : undefined),
    [experiment, reduced, startAt],
  );
  const [layers, setLayers] = useState<Layers>({ uv: true, visible: true });
  const [active, setActive] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const scaleBar = useRef<HTMLDivElement>(null);

  useEffect(() => playback.start(), [playback]);

  // stop the clock and the renderer while the replay is offscreen
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      playback.active = entry.isIntersecting;
      setActive(entry.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [playback]);

  const t = experiment.test;
  return (
    <div className="x3d" ref={root}>
      <figure className="x3d-stage">
        <Suspense fallback={<div className="x3d-empty">Starting 3D…</div>}>
          <Scene
            experiment={experiment}
            playback={playback}
            layers={layers}
            scaleBar={scaleBar}
            active={active}
            reducedMotion={reduced}
          />
        </Suspense>
        <div className="x3d-scale mono" aria-hidden="true">
          <div ref={scaleBar} />
          10 mm at the droplet
        </div>
        <figcaption className="x3d-phase mono">
          <Phase experiment={experiment} playback={playback} />
        </figcaption>
      </figure>
      <FramesPanel experiment={experiment} playback={playback} />
      <div className="x3d-under">
        <Timeline experiment={experiment} playback={playback} />
        <Readouts experiment={experiment} playback={playback} layers={layers} onLayers={setLayers} />
        <p className="x3d-note">
          3D replay drawn from measured data, not a recording · test #{t.test_no}. From the data: droplet and flame
          diameters, droplet position, all timing (needles and igniters from the test log). Estimate: the 3D position
          combines two camera views{t.fiber ? "; the fiber direction follows the droplet's drift" : ""}. To scale: the
          combustion chamber (0.40 m inner diameter, 0.78 m long, eight windows; NASA/TM—2005-213973). Illustrative:
          flame colours and flicker, shapes of needles and igniters, window placement. Drag to rotate, scroll to zoom.
        </p>
      </div>
    </div>
  );
}
