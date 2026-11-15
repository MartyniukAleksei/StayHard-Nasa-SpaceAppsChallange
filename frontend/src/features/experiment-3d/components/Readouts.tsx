import type { Experiment } from "../lib/experiment";
import { usePlayback, type Playback } from "../lib/playback";
import { sample } from "../lib/series";
import type { Layers } from "./Scene";

const mm = (v: number | null, digits = 2) => (v == null ? "—" : `${v.toFixed(digits)} mm`);

interface Props {
  experiment: Experiment;
  playback: Playback;
}

/** Live numbers at the playback cursor. Every value is interpolated from the measured series. */
export function Readouts({ experiment, playback, layers, onLayers }: Props & { layers: Layers; onLayers: (l: Layers) => void }) {
  const { t } = usePlayback(playback);
  const d = sample(experiment.droplet, "d_mm", t);
  const uv = sample(experiment.flameUv, "flame_d_mm", t);
  const vis = sample(experiment.flameColor, "flame_d_mm", t);
  const standoff = sample(experiment.flameUv, "standoff", t);
  return (
    <div className="x3d-readout mono">
      <span>
        t = {t < 0 ? "−" : "+"}
        {Math.abs(t).toFixed(2)} s
      </span>
      <span>droplet {mm(d)}</span>
      <span>d² {d == null ? "—" : `${(d * d).toFixed(2)} mm²`}</span>
      {experiment.flameColor && (
        <label className="x3d-layer x3d-vis">
          <input
            type="checkbox"
            checked={layers.visible}
            onChange={(e) => onLayers({ ...layers, visible: e.target.checked })}
          />
          flame, color camera {vis == null ? "none" : mm(vis, 1)}
        </label>
      )}
      {experiment.flameUv && (
        <label className="x3d-layer x3d-uv">
          <input type="checkbox" checked={layers.uv} onChange={(e) => onLayers({ ...layers, uv: e.target.checked })} />
          flame, UV camera {uv == null ? "none" : mm(uv, 1)}
        </label>
      )}
      <span>standoff {standoff == null ? "—" : standoff.toFixed(2)}</span>
    </div>
  );
}

/** One line saying what is happening at the cursor: hardware phases come from the test log. */
export function Phase({ experiment, playback }: Props) {
  const { t } = usePlayback(playback);
  const ev = experiment.events;
  const fiber = experiment.test.fiber;
  const flameStart = Math.min(experiment.flameUv?.t0 ?? Infinity, experiment.flameColor?.t0 ?? Infinity);
  const end = experiment.flameEnd;

  if (ev.needlesRetract != null && t < ev.needlesRetract) return <>Droplet held between two deployment needles</>;
  if (ev.igniterOn != null && t < ev.igniterOn) {
    return <>{fiber ? "Needles retracted, droplet stays on the fiber" : "Needles retracted, droplet floats free"}</>;
  }
  if (t < flameStart) return <>{ev.igniterOn != null ? "Hot-wire igniters on" : "Before ignition"}</>;
  if (end != null && t > end) {
    return <>No flame measured after t = {end.toFixed(1)} s · end: {experiment.test.end_type}</>;
  }
  if (t < 0) return <span className="x3d-live">Ignition, igniters still on</span>;
  if (ev.igniterRetracted != null && t < ev.igniterRetracted) {
    return <span className="x3d-live">Igniters off and retracting</span>;
  }
  return <span className="x3d-live">Burning: a spherical flame in microgravity</span>;
}
