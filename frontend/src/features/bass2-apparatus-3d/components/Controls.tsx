import { CONFIGS, FLOW, MODES, O2, REPORT, ROD_RADII_CM, type ConfigId, type ModeId } from "../content";
import { boundaryO2, flowLabel, flowToSlider, sliderToFlow } from "../lib/boundary";
import { useSim, type Sim } from "../lib/sim";
import type { Layers } from "./Scene";

const page = (p: number) => `p.${p}`;

/** Mode switch: three sample types; the rod has a sub-toggle for the flow direction. */
export function ModeSwitch({ sim }: { sim: Sim }) {
  const { config } = useSim(sim);
  const mode: ModeId = CONFIGS[config].mode;
  return (
    <div className="b3d-modes">
      <div className="b3d-tags" role="group" aria-label="Sample">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`tag ${m.id === mode ? "on" : ""}`}
            aria-pressed={m.id === mode}
            onClick={() => m.id !== mode && sim.setConfig(m.configs[0])}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === "rod" && (
        <div className="b3d-tags" role="group" aria-label="Flow direction for the rod">
          {(["rod-concurrent", "rod-opposed"] as ConfigId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`tag ${id === config ? "on" : ""}`}
              aria-pressed={id === config}
              onClick={() => sim.setConfig(id)}
            >
              {id === "rod-concurrent" ? "concurrent / stagnation flow" : "opposed flow"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** What is happening now, in one line. Wording follows the report; the timing is schematic. */
export function Phase({ sim }: { sim: Sim }) {
  const { flame, config, regime, o2 } = useSim(sim);
  const rod = config === "rod-concurrent";
  switch (flame.phase) {
    case "igniting":
      return <>Hot-wire igniter on, within about 1 mm of the sample</>;
    case "burning":
      return <span className="b3d-live">{rod ? "Burning: the flame wraps the tip that faces the flow" : `Burning: ${CONFIGS[config].flow}-flow flame spread`}</span>;
    case "quenching":
      return (
        <span className="b3d-live">
          {rod
            ? "Quenching: the flame shrinks to a hemisphere and oscillates at about 1.1 Hz (p.72)"
            : "Quenching: the flame shrinks and fades at too little flow"}
        </span>
      );
    case "blowing":
      return <span className="b3d-live">{rod ? "Blowoff: a hole opens at the stagnation tip (p.73)" : "Blowoff: the flow strips the flame's leading edge"}</span>;
    case "out":
      if (flame.reason === "loop-end") return <>End of the schematic loop, restarting</>;
      if (flame.reason === "quench") return <>No flame: quenched at low flow</>;
      if (flame.reason === "blowoff") return <>No flame: blown off at high flow</>;
      if (rod && regime === "burning" && o2 < O2.ignitionLimit) {
        return <>No sustained ignition below about {O2.ignitionLimit} % O₂ (p.68)</>;
      }
      return <>No sustained flame at this setting</>;
  }
}

/** Sliders for the rod in concurrent flow: the only configuration with a boundary equation. */
function RodControls({ sim }: { sim: Sim }) {
  const { u, o2, radiusIndex, stretch } = useSim(sim);
  return (
    <div className="b3d-sliders">
      <label className="b3d-slider">
        <span>flow</span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(flowToSlider(u, FLOW.minCmS, FLOW.maxCmS) * 1000)}
          onChange={(e) => sim.setFlow(sliderToFlow(Number(e.target.value) / 1000, FLOW.minCmS, FLOW.maxCmS))}
          aria-valuetext={flowLabel(u, FLOW.calibratedMinCmS)}
        />
        <output className="mono">{flowLabel(u, FLOW.calibratedMinCmS)}</output>
      </label>
      <label className="b3d-slider">
        <span>O₂</span>
        <input
          type="range"
          min={O2.min * 10}
          max={O2.max * 10}
          value={Math.round(o2 * 10)}
          onChange={(e) => sim.setO2(Number(e.target.value) / 10)}
          aria-valuetext={`${o2.toFixed(1)} percent`}
        />
        <output className="mono">{o2.toFixed(1)} % vol</output>
      </label>
      <div className="b3d-tags" role="group" aria-label="Rod radius">
        <span className="b3d-label">rod radius</span>
        {ROD_RADII_CM.map((r, i) => (
          <button key={r} type="button" className={`tag ${i === radiusIndex ? "on" : ""}`} aria-pressed={i === radiusIndex} onClick={() => sim.setRadius(i)}>
            {r} cm
          </button>
        ))}
      </div>
      <div className="b3d-readout mono">
        <span>stretch rate a = {stretch < 10 ? stretch.toFixed(1) : stretch.toFixed(0)} 1/s</span>
        <span>boundary at this a: {boundaryO2(stretch).toFixed(1)} % O₂ (Eq. 6.1, estimate)</span>
      </div>
    </div>
  );
}

/** Three flow levels for the configurations the report describes only in words and tables. */
function LevelControls({ sim }: { sim: Sim }) {
  const { config, levelIndex } = useSim(sim);
  const levels = CONFIGS[config].levels;
  const level = levels[levelIndex[config]];
  return (
    <div className="b3d-sliders">
      <div className="b3d-tags" role="group" aria-label="Flow">
        <span className="b3d-label">flow</span>
        {levels.map((l, i) => (
          <button key={l.id} type="button" className={`tag ${l === level ? "on" : ""}`} aria-pressed={l === level} onClick={() => sim.setLevel(i)}>
            {l.label}
          </button>
        ))}
      </div>
      {level && (
        <p className="b3d-caption">
          {level.caption} <span className="mono">({page(level.page)})</span>
        </p>
      )}
    </div>
  );
}

export function Controls({ sim, layers, onLayers }: { sim: Sim; layers: Layers; onLayers: (l: Layers) => void }) {
  const { config, flame } = useSim(sim);
  const c = CONFIGS[config];
  return (
    <div className="b3d-controls">
      <div className="b3d-head">
        <h3 className="b3d-title">{c.title}</h3>
        <p className="b3d-sub">
          {c.investigators} · {c.sample} <span className="mono">({page(c.samplePage)})</span>. {c.ignition}
        </p>
      </div>
      {config === "rod-concurrent" ? <RodControls sim={sim} /> : <LevelControls sim={sim} />}
      <div className="b3d-actions">
        <button type="button" className="btn" onClick={() => sim.ignite()} disabled={flame.phase === "igniting"}>
          ignite
        </button>
        <label className="b3d-layer">
          <input type="checkbox" checked={layers.tracers} onChange={(e) => onLayers({ ...layers, tracers: e.target.checked })} />
          flow tracers
        </label>
        <label className="b3d-layer">
          <input type="checkbox" checked={layers.cameras} onChange={(e) => onLayers({ ...layers, cameras: e.target.checked })} />
          cameras
        </label>
      </div>
      <ul className="b3d-facts">
        {c.facts.map((f) => (
          <li key={f.text}>
            {f.text} <span className="mono">({page(f.page)})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Confidence levels of what is drawn; must match the scene passport. */
export function Note() {
  return (
    <p className="b3d-note">
      A schematic simulation of the BASS-II apparatus, not a recording and not a replay of any test. From the report (
      {REPORT.title}): duct 7.6 × 7.6 × 17 cm and the order of its parts (fan, honeycomb, air-speed probe, inlet
      screen, perforated copper plate, brass screen), sample sizes, igniter, camera and radiometer positions, flow
      range up to ~55 cm/s, the flammability boundary Eq. 6.1 and every number with a page. Estimate: whether a chosen
      setting burns, quenches or blows off (Eq. 6.1 applied to your values, rod in concurrent flow only). Schematic:
      flame shape and size, how fast it travels, all timing (a loop, not to time scale), holders, fan, honeycomb
      cells, camera bodies. Illustrative: flame colour and flicker, flow tracers. Flow below ~{FLOW.calibratedMinCmS}{" "}
      cm/s is shown without a number: it is below the fan's calibrated range. Data:{" "}
      <a href={REPORT.doiUrl} target="_blank" rel="noreferrer">
        {REPORT.accession}, DOI {REPORT.doi}
      </a>
      . Drag to rotate, scroll to zoom.
    </p>
  );
}
