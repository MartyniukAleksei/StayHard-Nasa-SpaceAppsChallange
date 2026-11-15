import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { CONFIGS, REPORT } from "../content";
import { Sim, useSim } from "../lib/sim";
import { BoundaryMap } from "./BoundaryMap";
import { Controls, ModeSwitch, Note, Phase } from "./Controls";
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
 * Schematic 3D simulation of the BASS-II flow duct for the study overview: three sample configurations,
 * a flow control and, for the rod in concurrent flow, the report's flammability boundary (Eq. 6.1).
 * No data is fetched: every number comes from content.ts with its report page.
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
  const { config, rodRadiusCm } = useSim(sim);
  const [layers, setLayers] = useState<Layers>({ tracers: true, cameras: true });
  const [active, setActive] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const scaleBar = useRef<HTMLDivElement>(null);

  useEffect(() => sim.start(), [sim]);

  // stop the clock and the renderer while the scene is offscreen
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      sim.active = entry.isIntersecting;
      setActive(entry.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [sim]);

  return (
    <div className="b3d" ref={root}>
      <ModeSwitch sim={sim} />
      <figure className="b3d-stage">
        <div className="b3d-view">
          <Suspense fallback={<div className="b3d-empty">Starting 3D…</div>}>
            <Scene
              sim={sim}
              config={config}
              rodRadius={rodRadiusCm * 10}
              layers={layers}
              scaleBar={scaleBar}
              active={active}
              reducedMotion={reduced}
            />
          </Suspense>
          <div className="b3d-flowdir mono" aria-hidden="true">
            flow →
          </div>
          <div className="b3d-kind mono">schematic · not to time scale</div>
          <div className="b3d-scale mono" aria-hidden="true">
            <div ref={scaleBar} />
            {SCALE_MM} mm at the sample
          </div>
        </div>
        <figcaption className="b3d-phase mono">
          <Phase sim={sim} />
        </figcaption>
      </figure>
      <div className="b3d-side">
        <Controls sim={sim} layers={layers} onLayers={setLayers} />
        {config === "rod-concurrent" && <BoundaryMap sim={sim} />}
      </div>
      <div className="b3d-under">
        <Note />
      </div>
    </div>
  );
}
