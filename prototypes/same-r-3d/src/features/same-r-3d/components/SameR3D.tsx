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
        <p className="s3d-note">
          3D replay drawn from measured data, not a recording · SAME-R test #{t.test_no}
          {experiment.aged ? ` (table rows ${t.test_id} and ${experiment.aged.test_id})` : ""}. From the data: heater
          on/off, plume temperature, P-Trak particle count, DustTrak B smoke mass, detector signals in volts, all timing
          (t = 0 is the first telemetry row with the heater on). From documents: the order of the parts. Smoke from the
          heated sample is drawn into the aging chamber; a piston later pushes it out through a small diagnostics duct
          that holds the ISS and STS smoke detectors and feeds the P-Trak, the DustTrak and the ionization detectors
          (SAME Baseline Concept Description, pp. 5–7). Half of the chamber is pushed out as fresh smoke and the rest
          after aging (Final Report p. 10), so the instruments see smoke in bursts, minutes after the heater. Also
          from documents: aging chamber bore 203 mm, flange 244 mm, length 211 mm (drawing 60089MFHA151); 2 mg/m³
          reference alarm level (SAME-2 slides 25–26). Estimate: detector change is measured from the level before
          heating and drawn on one 6 V scale for all tests. Schematic: every size and position except the chamber,
          including the duct, the detector and instrument housings, the sampling lines and the flow arrows; elbows,
          gate valves, the piston, the mixing fan and the diluter are not drawn; which enclosure holds each ionization
          detector in SAME-R is not established. Illustrative: the haze in the duct (its point count follows the
          P-Trak reading), haze colour and drift, heater glow, warm tint, brightness of the housings. Not shown because
          it was not measured: the smoke inside the chamber (so the chamber is opaque), the shape or motion of the
          smoke, piston and valve timing, particle sizes in this test, detector alarm thresholds. There is no flame in
          SAME-R. Drag to rotate, scroll to zoom.
        </p>
        <p className="s3d-note">Source: NASA PSI, SAME-R (PSI-101), DOI 10.60555/2np7-jv14.</p>
      </div>
    </div>
  );
}
