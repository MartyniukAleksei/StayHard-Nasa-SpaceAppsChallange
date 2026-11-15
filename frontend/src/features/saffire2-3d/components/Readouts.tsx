import { usePlayback, type Playback } from "@/shared/three/playback";
import { co2At, stateAt, valueAt, type SaffireModel } from "../lib/model";

const fmt = (v: number | null, d: number, unit: string) => (v == null || !Number.isFinite(v) ? "no data" : `${v.toFixed(d)} ${unit}`);
const signed = (t: number) => `${t >= 0 ? "+" : "−"}${Math.abs(t).toFixed(1)} s`;

// Readme Table 1 lists 30 cm/s for these two samples; the PSI experiment table says 20.
const README_FLOW_30 = new Set(["2-6", "2-9"]);

/** One line under the scene: what happens now (data / table / estimate). */
export function Phase({ model, playback }: { model: SaffireModel; playback: Playback }) {
  usePlayback(playback);
  const { moment, samples } = stateAt(model, playback.t);
  const act = samples.find((x) => x.active);
  if (!act || act.tIgn == null) {
    if (!moment.segment) return <>Between recordings (pause shortened on the timeline)</>;
    return <>Sample {moment.segment.id} recording</>;
  }
  const { s, tIgn, burn, igniterOn } = act;
  const head = `Sample ${s.id} · ${s.sample.material} · ${signed(tIgn)} from ignition · `;
  if (tIgn < 0) return <>{head}waiting for ignition</>;
  if (igniterOn) return <>{head}<span className="sf3d-live">igniter on</span></>;
  if (burn.flame && burn.mode === "anchored")
    return <>{head}<span className="sf3d-live">flame held at the base</span> (Note 4), damage {burn.burned.toFixed(0)} mm (estimate)</>;
  if (burn.flame) return <>{head}<span className="sf3d-live">flame front at {burn.flameTo.toFixed(0)} mm</span> (estimate)</>;
  if (burn.mode === "none") return <>{head}no sustained flame (table: burned ~0)</>;
  return <>{head}flame out · burned {(burn.burned / 10).toFixed(0)} cm (table)</>;
}

export function Readouts({ model, playback, labels, onLabels }: { model: SaffireModel; playback: Playback; labels: boolean; onLabels: (v: boolean) => void }) {
  usePlayback(playback);
  const { moment, samples } = stateAt(model, playback.t);
  const act = samples.find((x) => x.active);
  const t = act?.tIgn ?? null;
  const flow = act && t != null ? valueAt(act.s.flow, t) : null;
  const rad = act && t != null ? valueAt(act.s.radiometer, t) : null;
  // CO₂ from the recording itself (1 Hz); between recordings there is no measurement
  const co2 = act && t != null && Number.isFinite(t) ? valueAt(act.s.co2, t) : co2At(model, moment.epoch);
  const done = samples.filter((x) => x.tIgn === Infinity && x.burn.burned > 0).length;
  return (
    <div className="sf3d-readout mono">
      <span>{act ? `${act.s.id} · ${act.s.sample.thickness_raw || "—"} · ${act.s.sample.flow_direction}` : "—"}</span>
      <span>CO₂ {fmt(co2, 0, "ppm")}</span>
      <span>
        flow {fmt(flow, 1, "cm/s")}
        {act && README_FLOW_30.has(act.s.id) ? " (table 20 · Readme 30)" : ""}
      </span>
      <span>radiation {fmt(rad, 1, "mW/cm²")}</span>
      <span>burn time {act?.s.sample.burn_time_s != null ? `${act.s.sample.burn_time_s} s (table)` : "—"}</span>
      <span>samples burned so far: {done}</span>
      <label className="sf3d-toggle">
        <input type="checkbox" checked={labels} onChange={(e) => onLabels(e.target.checked)} /> labels
      </label>
    </div>
  );
}
