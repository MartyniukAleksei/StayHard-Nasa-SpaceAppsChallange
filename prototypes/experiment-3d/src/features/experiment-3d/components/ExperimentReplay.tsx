import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { loadExperiment, type Experiment } from "../lib/experiment";
import { Playback } from "../lib/playback";
import { FramesPanel } from "./FramesPanel";
import { Header, PhaseBanner, Readouts, SourcesFooter } from "./Hud";
import type { Layers } from "./Scene";
import { Timeline } from "./Timeline";

// three.js вантажиться окремим чанком, лише коли відкрито replay
const Scene = lazy(() => import("./Scene").then((m) => ({ default: m.Scene })));

export function ExperimentReplay({ testNo }: { testNo: number }) {
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setExperiment(null);
    setError(null);
    loadExperiment(testNo).then(
      (e) => alive && setExperiment(e),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [testNo]);

  if (error) return <div className="x3d-status">Cannot load FLEX-{testNo}: {error}</div>;
  if (!experiment) return <div className="x3d-status">Loading FLEX-{testNo} measurements…</div>;
  return <Replay experiment={experiment} />;
}

function Replay({ experiment }: { experiment: Experiment }) {
  const playback = useMemo(() => new Playback(experiment.tMin, experiment.tMax), [experiment]);
  const [layers, setLayers] = useState<Layers>({ uv: true, visible: true });
  const scaleBar = useRef<HTMLDivElement>(null);
  useEffect(() => playback.start(), [playback]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        playback.toggle();
      }
      if (e.code === "ArrowRight") playback.seek(playback.t + 0.1);
      if (e.code === "ArrowLeft") playback.seek(playback.t - 0.1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playback]);

  return (
    <div className="x3d">
      <div className="x3d-stage">
        <Suspense fallback={<div className="x3d-status">Starting 3D…</div>}>
          <Scene experiment={experiment} playback={playback} layers={layers} scaleBar={scaleBar} />
        </Suspense>
        <Header experiment={experiment} />
        <Readouts experiment={experiment} playback={playback} layers={layers} onLayers={setLayers} />
        <PhaseBanner experiment={experiment} playback={playback} />
        <div className="x3d-scale">
          <div ref={scaleBar} />
          <span>10 mm at the droplet</span>
        </div>
      </div>
      <FramesPanel experiment={experiment} playback={playback} />
      <div className="x3d-bottom">
        <Timeline experiment={experiment} playback={playback} />
        <SourcesFooter experiment={experiment} />
      </div>
    </div>
  );
}
