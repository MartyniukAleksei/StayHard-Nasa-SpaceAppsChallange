import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSameRExperiment } from "../api";
import type { Experiment } from "../lib/experiment.ts";
import { Playback } from "../lib/playback";
import { Instruments, Phase, Readouts } from "./Readouts";
import type { Layers } from "./Scene";
import { Timeline } from "./Timeline";
import "./same-r-3d.css";

// three.js is a separate chunk: it loads only when the scene is shown
const Scene = lazy(() => import("./Scene").then((m) => ({ default: m.Scene })));

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** 3D replay of one SAME-R test, drawn from its 1 Hz telemetry. */
export function SameR3D({ testNo, startAt }: { testNo: number; startAt?: number }) {
  const state = useSameRExperiment(testNo);
  if (state.status === "pending") return <div className="s3d-empty">Loading telemetry…</div>;
  if (state.status === "error") return <div className="s3d-empty">3D replay unavailable ({state.message}).</div>;
  if (state.status === "empty") return <div className="s3d-empty">No telemetry for test #{testNo}.</div>;
  return <Replay experiment={state.experiment} startAt={startAt} />;
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

/** `startAt`: open paused at this second instead of playing from 10 s before the heater turns on. */
function Replay({ experiment, startAt }: { experiment: Experiment; startAt?: number }) {
  const reduced = useMemo(prefersReducedMotion, []);
  const webgl = useMemo(hasWebGL, []);
  const playback = useMemo(() => {
    const p = new Playback(experiment.tMin, experiment.tMax, !reduced && startAt == null, Math.max(experiment.tMin, -10));
    p.speed = 10;
    if (startAt != null) p.seek(startAt);
    return p;
  }, [experiment, reduced, startAt]);
  const [layers, setLayers] = useState<Layers>({ haze: true, detectors: true, apparatus: true });
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

  // without WebGL the numbers, gauges and timeline below still work from the same data
  const noScene = (reason: string) => <div className="s3d-empty">{reason} The readouts and the timeline still show the data.</div>;
  const t = experiment.test;
  return (
    <div className="s3d" ref={root}>
      <figure className="s3d-stage">
        {webgl ? (
          <SceneBoundary fallback={noScene("The 3D scene failed to start on this device.")}>
            <Suspense fallback={<div className="s3d-empty">Starting 3D…</div>}>
              <Scene experiment={experiment} playback={playback} layers={layers} scaleBar={scaleBar} active={active} reducedMotion={reduced} />
            </Suspense>
            <div className="s3d-scale mono" aria-hidden="true">
              <div ref={scaleBar} />
              50 mm at the scene centre
            </div>
          </SceneBoundary>
        ) : (
          noScene("This browser has no WebGL, so the 3D scene cannot be drawn.")
        )}
        <figcaption className="s3d-phase mono">
          <Phase experiment={experiment} playback={playback} />
        </figcaption>
      </figure>
      <Instruments experiment={experiment} playback={playback} layers={layers} />
      <div className="s3d-under">
        <Timeline experiment={experiment} playback={playback} />
        <Readouts experiment={experiment} playback={playback} layers={layers} onLayers={setLayers} />
        <details className="s3d-note">
          <summary>
            Drawn from measured data, not a recording · test #{t.test_no}. Drag to rotate, scroll to zoom.
          </summary>
          <ul>
            <li>
              <b>Data:</b> heater, smoke temperature, P-Trak count, DustTrak B mass, detector volts, timing (t = 0 =
              heater on){experiment.aged ? `; rows ${t.test_id} and ${experiment.aged.test_id}` : ""}.
            </li>
            <li>
              <b>Documents:</b> part order (Baseline Concept Description pp. 5–7), aging chamber size (drawing
              60089MFHA151), fresh then aged smoke bursts (Final Report p. 10).
            </li>
            <li>
              <b>Schematic or illustrative:</b> other sizes and positions, haze look (its density follows P-Trak), glow.
            </li>
            <li>
              <b>Not shown, not measured:</b> smoke inside the chamber, smoke shape, piston timing, particle sizes, alarm
              thresholds. There is no flame in SAME-R.
            </li>
            <li>
              Source: NASA PSI, SAME-R (PSI-101)
              {experiment.doi ? `, DOI ${experiment.doi.url.replace("https://doi.org/", "")}` : ""}.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}
