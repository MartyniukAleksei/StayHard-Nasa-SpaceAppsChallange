import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { DropletReplay } from "@/features/replay";
import { useExperiment } from "../api";
import type { Experiment } from "../lib/experiment";
import { Playback } from "../lib/playback";
import { readTour, TOUR_EVENT, TourRunner, type TourSpec } from "../lib/tour";
import { FramesPanel } from "./FramesPanel";
import { Phase, Readouts } from "./Readouts";
import type { Layers } from "./Scene";
import { Timeline } from "./Timeline";
import { TourDirector, TourSteps } from "./TourDirector";
import "./experiment-3d.css";

// three.js is a separate chunk: it loads only when the 3D replay is opened
const loadScene = () => import("./Scene");
const Scene = lazy(() => loadScene().then((m) => ({ default: m.Scene })));
/** Fetches the 3D chunk ahead of time (the assistant calls it while it prepares a walkthrough). */
export const preloadScene = () => void loadScene().catch(() => {});

const FRAMES_WAIT_MS = 8000; // NASA PSI serves a frame in 1–2 s; do not hold the tour for longer than this

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const storage = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The assistant's walkthrough for this test: `?tour=<id>` in the URL or the `agent:tour` window event;
 *  the steps themselves wait in sessionStorage (docs/agent/ui-actions.md). */
function useTourSpec(testNo: number): [TourSpec | null, () => void] {
  const [params] = useSearchParams();
  const id = params.get("tour");
  const forTest = useCallback(
    (tourId: string | null) => {
      const spec = readTour(storage(), tourId);
      return spec?.test_no === testNo ? spec : null;
    },
    [testNo],
  );
  const [spec, setSpec] = useState<TourSpec | null>(() => forTest(id));
  useEffect(() => setSpec(forTest(id)), [forTest, id]);
  useEffect(() => {
    const onTour = (e: Event) => {
      const next = forTest((e as CustomEvent<string>).detail);
      if (next) setSpec({ ...next }); // a new object: the same tour asked again starts over
    };
    window.addEventListener(TOUR_EVENT, onTour);
    return () => window.removeEventListener(TOUR_EVENT, onTour);
  }, [forTest]);
  return [spec, useCallback(() => setSpec(null), [])];
}

/** 3D replay of one FLEX test, drawn from its measured series, next to the real onboard frames. */
/** startAt: open paused at this moment (s after ignition), e.g. from ?t= in the URL. */
export function Experiment3D({ testNo, startAt }: { testNo: number; startAt?: number }) {
  const state = useExperiment(testNo);
  const webgl = useMemo(hasWebGL, []);
  const [tour, exitTour] = useTourSpec(testNo);

  if (!webgl) return <Fallback testNo={testNo} tour={tour} reason="This browser has no WebGL, so the 3D scene cannot be drawn." />;
  if (state.status === "pending") return <div className="x3d-empty">Loading measured series…</div>;
  if (state.status === "error") return <div className="x3d-empty">3D replay unavailable ({state.message}).</div>;
  if (state.status === "empty") return <div className="x3d-empty">No droplet series for test #{testNo}.</div>;
  return (
    <SceneBoundary fallback={<Fallback testNo={testNo} tour={tour} reason="The 3D scene failed to start on this device." />}>
      <Replay experiment={state.experiment} startAt={startAt} tour={tour} onExitTour={exitTour} />
    </SceneBoundary>
  );
}

function Fallback({ testNo, reason, tour }: { testNo: number; reason: string; tour: TourSpec | null }) {
  return (
    <div className="x3d-fallback">
      <p className="x3d-note">{reason} Showing the 2D replay from the same data instead.</p>
      <DropletReplay key={tour?.id} testNo={testNo} startAt={tour?.steps[0].t} />
      {tour && (
        <>
          <p className="x3d-note">The assistant's walkthrough, step by step:</p>
          <TourSteps steps={tour.steps} />
        </>
      )}
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

interface ReplayProps {
  experiment: Experiment;
  startAt?: number;
  tour: TourSpec | null;
  onExitTour: () => void;
}

const noSubscribe = () => () => {};
const zero = () => 0;

function Replay({ experiment, startAt, tour, onExitTour }: ReplayProps) {
  const reduced = useMemo(prefersReducedMotion, []);
  // a replay opened for a walkthrough waits at the start instead of playing on its own
  const opensWithTour = useRef(tour != null).current;
  // with reduced motion: paused on a frame that already shows the flame
  const playback = useMemo(
    () =>
      startAt != null
        ? new Playback(experiment.tMin, experiment.tMax, false, startAt) // a chosen moment: paused on it
        : opensWithTour
          ? new Playback(experiment.tMin, experiment.tMax, false)
          : new Playback(experiment.tMin, experiment.tMax, !reduced, reduced ? Math.min(2, experiment.tMax) : undefined),
    [experiment, reduced, startAt, opensWithTour],
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

  // --- the assistant's walkthrough ---
  const runner = useMemo(() => (tour ? new TourRunner(tour, playback, reduced) : null), [tour, playback, reduced]);
  useSyncExternalStore(runner?.subscribe ?? noSubscribe, runner?.getVersion ?? zero);
  useEffect(() => () => runner?.release(), [runner]);
  const [sceneReady, setSceneReady] = useState(false);
  const [primed, setPrimed] = useState<TourRunner | null>(null); // frames of the first step are loaded
  useEffect(() => {
    if (!runner) return;
    setLayers({ uv: true, visible: true }); // the tour may point at either flame
    root.current?.scrollIntoView({ block: "nearest" });
    const timer = window.setTimeout(() => setPrimed(runner), FRAMES_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [runner]);
  useEffect(() => {
    if (runner && sceneReady && primed === runner) runner.begin();
  }, [runner, sceneReady, primed]);
  const onPrimed = useCallback(() => setPrimed(runner), [runner]);
  const tourTimes = useMemo(() => tour?.steps.map((s) => s.t) ?? [], [tour]);
  // while a step with show_frame is held, the real frame of that second is marked with the step's text
  const step = runner?.labelsVisible ? runner.step : null;
  const frameMark = step?.show_frame
    ? (step.labels.filter((l) => l.at === "frame").map((l) => l.text).join(" · ") || step.labels.map((l) => l.text).join(" · ") || "This moment in the real frame")
    : null;

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
            tour={runner}
            onReady={() => setSceneReady(true)}
          />
        </Suspense>
        {/* reduced motion: the view changes with a short fade instead of a flight */}
        {runner && reduced && <div key={runner.flight} className="x3d-cut" aria-hidden="true" />}
        {runner?.phase === "waiting" && <div className="x3d-tour-wait mono">Preparing 3D walkthrough…</div>}
        <div className="x3d-scale mono" aria-hidden="true">
          <div ref={scaleBar} />
          10 mm at the droplet
        </div>
        <figcaption className="x3d-phase mono">
          <Phase experiment={experiment} playback={playback} />
        </figcaption>
      </figure>
      <FramesPanel experiment={experiment} playback={playback} tourTimes={tourTimes} onPrimed={onPrimed} mark={frameMark} />
      {runner && <TourDirector tour={runner} onExit={onExitTour} />}
      <div className="x3d-under">
        <Timeline experiment={experiment} playback={playback} />
        <Readouts experiment={experiment} playback={playback} layers={layers} onLayers={setLayers} />
        <p className="x3d-note">
          3D replay drawn from measured data, not a recording · test #{t.test_no}. From the data: droplet and flame
          diameters, droplet position, all timing (needles and igniters from the test log). Estimate: the 3D position
          combines two camera views{t.fiber ? "; the fiber direction follows the droplet's drift" : ""}. To scale: the
          combustion chamber (0.40 m inner diameter, 0.78 m long, eight windows; NASA/TM—2005-213973). Illustrative:
          flame colours and flicker, shapes of needles and igniters, window placement. Drag to rotate, scroll to zoom.
          {runner &&
            " Walkthrough: the assistant chose the moments, views and wording; every number in a label is filled in from the data, and the camera views are illustrative."}
        </p>
      </div>
    </div>
  );
}
