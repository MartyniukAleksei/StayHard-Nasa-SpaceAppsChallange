import type { Experiment } from "../lib/experiment";
import { usePlayback, type Playback } from "../lib/playback";
import { sample } from "../lib/series";
import type { Layers } from "./Scene";

const pct = (v: number | null) => (v ? `${(v * 100).toFixed(0)}%` : null);
const num = (v: number | null, digits = 2) => (v == null ? "—" : v.toFixed(digits));

// Формулювання end_type — з доменних правил: Disruption ≠ «горіло б вічно».
const END_TEXT: Record<string, string> = {
  Extinction: "flame self-extinguished",
  Completion: "droplet burned to completion",
  Disruption: "self-extinction not observed",
};

export function Header({ experiment }: { experiment: Experiment }) {
  const t = experiment.test;
  const gas = [
    ["O₂", pct(t.x_o2)],
    ["N₂", pct(t.x_n2)],
    ["CO₂", pct(t.x_co2)],
    ["He", pct(t.x_he)],
  ].filter(([, v]) => v);
  return (
    <header className="x3d-header x3d-glass">
      <div className="x3d-eyebrow">FLEX · ISS droplet combustion · {t.test_date}</div>
      <h1>
        FLEX-{t.test_no} <span>{t.fuel} droplet{t.ts_fiber ? " on a fiber" : ", free-floating"}</span>
      </h1>
      <div className="x3d-chips">
        {t.p_atm != null && <span>{t.p_atm.toFixed(2)} atm</span>}
        {gas.map(([name, v]) => (
          <span key={name}>
            {name} {v}
          </span>
        ))}
        {t.d0_mm != null && <span>d₀ {t.d0_mm.toFixed(2)} mm</span>}
        {t.k_mm2_s != null && <span>K {t.k_mm2_s.toFixed(2)} mm²/s</span>}
        {t.end_type && (
          <span className="x3d-chip-end">
            {t.end_type}: {END_TEXT[t.end_type] ?? ""}
          </span>
        )}
      </div>
    </header>
  );
}

interface ReadoutsProps {
  experiment: Experiment;
  playback: Playback;
  layers: Layers;
  onLayers: (l: Layers) => void;
}

export function Readouts({ experiment, playback, layers, onLayers }: ReadoutsProps) {
  const { t } = usePlayback(playback);
  const d = sample(experiment.droplet, "d_mm", t);
  const uv = sample(experiment.flameUv, "flame_d_mm", t);
  const vis = sample(experiment.flameColor, "flame_d_mm", t);
  const standoff = sample(experiment.flameUv, "standoff", t);
  return (
    <aside className="x3d-readouts x3d-glass">
      <div className="x3d-time">
        <small>t from ignition</small>
        {t >= 0 ? "+" : "−"}
        {Math.abs(t).toFixed(2)} s
      </div>
      <dl>
        <dt>Droplet diameter</dt>
        <dd>{num(d)} mm</dd>
        <dt>d²</dt>
        <dd>{num(d == null ? null : d * d)} mm²</dd>
        <dt>
          <label className="x3d-layer x3d-layer-vis">
            <input
              type="checkbox"
              checked={layers.visible}
              onChange={(e) => onLayers({ ...layers, visible: e.target.checked })}
            />
            Flame, color camera
          </label>
        </dt>
        <dd>{vis == null ? "no flame" : `${num(vis, 1)} mm`}</dd>
        <dt>
          <label className="x3d-layer x3d-layer-uv">
            <input
              type="checkbox"
              checked={layers.uv}
              onChange={(e) => onLayers({ ...layers, uv: e.target.checked })}
            />
            Flame, UV camera (OH*)
          </label>
        </dt>
        <dd>{uv == null ? "no flame" : `${num(uv, 1)} mm`}</dd>
        <dt>Flame standoff ratio</dt>
        <dd>{num(standoff)}</dd>
      </dl>
      <p className="x3d-scale-note">
        Blue line: droplet path. Chamber is to scale (0.40 m inner diameter, 0.78 m long, eight windows). Needles
        and igniters{experiment.test.ts_fiber ? ", fiber" : ""} are schematic shapes; their timing comes from the test log.
      </p>
    </aside>
  );
}

export function PhaseBanner({ experiment, playback }: { experiment: Experiment; playback: Playback }) {
  const { t } = usePlayback(playback);
  const flameStart = Math.min(experiment.flameUv?.t0 ?? Infinity, experiment.flameColor?.t0 ?? Infinity);
  const end = experiment.flameEnd;
  const ev = experiment.events;
  let text: string;
  let tone = "idle";
  if (ev.needlesRetract != null && t < ev.needlesRetract) text = "Droplet held between two deployment needles";
  else if (ev.igniterOn != null && t < ev.igniterOn)
    text = experiment.test.ts_fiber ? "Needles retracted — droplet stays on the fiber" : "Needles retracted — droplet floats free";
  else if (t < flameStart) text = "Hot-wire igniters on";
  else if (t < 0) {
    text = "Ignition — igniters still on";
    tone = "burn";
  } else if (ev.igniterRetracted != null && t < ev.igniterRetracted && (end == null || t <= end)) {
    text = "Igniters off and retracting";
    tone = "burn";
  } else if (end == null || t <= end) {
    text = "Burning — spherical flame in microgravity";
    tone = "burn";
  } else {
    text = `Flame no longer measured after t = ${end.toFixed(1)} s · ${experiment.test.end_type ?? "end of data"}`;
    tone = "out";
  }
  return (
    <div className={`x3d-phase x3d-phase-${tone}`}>
      {text}
      {tone === "out" && experiment.test.ts_comment && (
        <p>
          <b>Researcher note:</b> {experiment.test.ts_comment}
        </p>
      )}
    </div>
  );
}

const FLEX_DOI = "https://doi.org/10.60555/mbq8-0451";

export function SourcesFooter({ experiment }: { experiment: Experiment }) {
  return (
    <footer className="x3d-footer">
      <span>
        <b>Data-driven visualization, not a recording.</b> Sizes, positions and timing are FLEX-
        {experiment.test.test_no} measurements; droplet position combines two camera views (estimate); flame colors,
        flicker and hardware shapes are illustrative.
      </span>
      <span>
        Source: NASA PSI, PSI-69 (FLEX), CC0 ·{" "}
        <a href={FLEX_DOI} target="_blank" rel="noreferrer">
          doi:10.60555/mbq8-0451
        </a>{" "}
        · <a href={experiment.detail.url}>test record</a>
      </span>
    </footer>
  );
}
