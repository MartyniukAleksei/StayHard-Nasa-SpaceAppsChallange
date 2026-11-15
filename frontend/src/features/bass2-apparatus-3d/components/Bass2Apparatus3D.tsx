import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useReplayReport } from "../api";
import { CONFIGS, FLAME_VISIBLE_PX, REPLAY_TESTS, REPORT, VIEWS } from "../content";
import { buildReplay } from "../lib/replay";
import { Sim, useSim, type Mode } from "../lib/sim";
import { BoundaryMap } from "./BoundaryMap";
import { Controls, ModeSwitch, Note, Phase, StoryStrip, ViewButtons } from "./Controls";
import { ReplayPanel, TestPicker } from "./ReplayPanel";
import type { Layers } from "./Scene";
import "./bass2-apparatus-3d.css";

// three.js is a separate chunk: it loads only when this block is rendered
const Scene = lazy(() => import("./Scene").then((m) => ({ default: m.Scene })));
const SCALE_MM = 20; // same value as in Scene.tsx; kept here so the shell does not import three.js

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

/**
 * 3D simulation of the BASS-II flow duct for the study overview. Two modes: a schematic model (four
 * sample configurations, a flow control and, for the rod in concurrent flow, the report's flammability
 * boundary, Eq. 6.1) and a replay of a real test driven by the series read from its NASA video.
 * Every constant comes from content.ts with its report page; replay numbers come from the test report API.
 */
export function Bass2Apparatus3D() {
  const webgl = useMemo(hasWebGL, []);
  if (!webgl) return <Fallback reason="This browser has no WebGL, so the 3D scene cannot be drawn." />;
  return (
    <SceneBoundary fallback={<Fallback reason="The 3D scene failed to start on this device." />}>
      <Simulation />
    </SceneBoundary>
  );
}

/** Without WebGL: the same report facts as text. */
function Fallback({ reason }: { reason: string }) {
  return (
    <div className="b3d-fallback">
      <p className="b3d-note">{reason} The facts the scene illustrates, from {REPORT.title}:</p>
      {Object.values(CONFIGS).map((c) => (
        <div key={c.id}>
          <h3 className="b3d-title">{c.title}</h3>
          <ul className="b3d-facts">
            {c.facts.map((f) => (
              <li key={f.text}>
                {f.text} <span className="mono">(p.{f.page})</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="b3d-note">
        Replays of tests {REPLAY_TESTS.map((t) => t.id).join(", ")} are on their test pages as charts next to the NASA video.
      </p>
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

function Simulation() {
  const reduced = useMemo(prefersReducedMotion, []);
  const sim = useMemo(() => new Sim(reduced), [reduced]);
  const { config, rodRadiusCm, sampleThicknessMm } = useSim(sim);
  const [mode, setMode] = useState<Mode>("model");
  const [testId, setTestId] = useState(REPLAY_TESTS[0].id);
  const [layers, setLayers] = useState<Layers>({ tracers: true, cameras: true });
  const [view, setView] = useState(VIEWS[0].id);
  const [viewRequest, setViewRequest] = useState(0);
  const [active, setActive] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const scaleBar = useRef<HTMLDivElement>(null);

  const test = REPLAY_TESTS.find((t) => t.id === testId) ?? REPLAY_TESTS[0];
  const report = useReplayReport(mode === "replay" ? test.id : null);

  useEffect(() => sim.start(), [sim]);

  // the replay follows the fetched report; leaving replay mode returns to the schematic model
  useEffect(() => {
    if (mode !== "replay") {
      sim.setReplay(null);
      return;
    }
    const d = report.data;
    if (!d) return;
    const model = buildReplay(d.video_series, FLAME_VISIBLE_PX);
    if (!model) {
      sim.setReplay(null);
      sim.setConfig(test.config);
      return;
    }
    sim.setReplay({ test, row: d.test, model });
  }, [mode, test, report.data, sim]);

  const pickView = (id: string) => {
    setView(id);
    setViewRequest((n) => n + 1);
  };
  const pickMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    pickView(m === "replay" ? "section" : VIEWS[0].id);
  };

  // stop the clock and the renderer while the scene is offscreen
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      sim.setActive(entry.isIntersecting);
      setActive(entry.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [sim]);

  return (
    <div className="b3d" ref={root}>
      <div className="b3d-top">
        <ModeSwitch sim={sim} mode={mode} onMode={pickMode} />
        {mode === "replay" && <TestPicker selected={test.id} onSelect={setTestId} />}
        <StoryStrip mode={mode} />
      </div>
      <figure className="b3d-stage">
        <div className="b3d-view">
          <Suspense fallback={<div className="b3d-empty">Starting 3D…</div>}>
            <Scene
              sim={sim}
              config={config}
              rodRadius={rodRadiusCm * 10}
              sampleThickness={sampleThicknessMm}
              layers={layers}
              view={view}
              viewRequest={viewRequest}
              scaleBar={scaleBar}
              active={active}
              reducedMotion={reduced}
            />
          </Suspense>
          <div className="b3d-flowdir mono" aria-hidden="true">
            flow →
          </div>
          <div className="b3d-kind mono">{mode === "replay" ? `replay · ${test.id} · flow and flame from the video (estimate)` : "schematic · not to time scale"}</div>
          <div className="b3d-scale mono" aria-hidden="true">
            <div ref={scaleBar} />
            {SCALE_MM} mm at the sample
          </div>
        </div>
        <figcaption className="b3d-phase mono">
          <Phase sim={sim} />
        </figcaption>
        <ViewButtons view={view} onView={pickView} />
      </figure>
      <div className="b3d-side">
        {mode === "replay" ? (
          <ReplayPanel
            sim={sim}
            test={test}
            report={report.data}
            status={report.isPending ? "pending" : report.isError ? "error" : "success"}
            layers={layers}
            onLayers={setLayers}
          />
        ) : (
          <>
            <Controls sim={sim} layers={layers} onLayers={setLayers} />
            {config === "rod-concurrent" && <BoundaryMap sim={sim} />}
          </>
        )}
      </div>
      <div className="b3d-under">
        <Note mode={mode} />
      </div>
    </div>
  );
}
