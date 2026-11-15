import {
  DETECTOR_FULL_SCALE_V,
  detectorChange,
  detectorFraction,
  heaterOn,
  MASS_ALARM_MG_M3,
  massFraction,
  PTRAK_LIMIT,
  reading,
  type Experiment,
} from "../lib/experiment.ts";
import { usePlayback, type Playback } from "../lib/playback";
import type { Layers } from "./Scene";

interface Props {
  experiment: Experiment;
  playback: Playback;
}

const NO_DATA = "no data";
const num = (v: number | null, digits: number, unit: string) => (v == null ? NO_DATA : `${v.toFixed(digits)} ${unit}`);
const ptrak = (v: number | null) =>
  v == null ? NO_DATA : `${v >= PTRAK_LIMIT ? "≥ " : ""}${Math.round(v).toLocaleString("en-US")} /cm³`;
const cell = (v: number | string | null, unit = "") => (v == null ? "not recorded" : `${v}${unit}`);

/** Numbers at the playback cursor: the 1 Hz sample nearest to it, exactly as in the snapshot CSV. */
export function Readouts({ experiment: e, playback, layers, onLayers }: Props & { layers: Layers; onLayers: (l: Layers) => void }) {
  const { t } = usePlayback(playback);
  const s = Math.round(t);
  const mass = e.hasMass ? reading(e, "dusttrak_b_mg_m3", t) : null;
  const toggle = (key: keyof Layers, label: string) => (
    <label className="s3d-layer">
      <input type="checkbox" checked={layers[key]} onChange={(ev) => onLayers({ ...layers, [key]: ev.target.checked })} />
      {label}
    </label>
  );
  return (
    <div className="s3d-readout mono">
      <span>
        t = {s < 0 ? "−" : "+"}
        {Math.abs(s)} s
      </span>
      <span className={heaterOn(e, t) ? "s3d-live" : undefined}>heater {heaterOn(e, t) ? "ON" : "off"}</span>
      <span>plume {num(reading(e, "plume_c", t), 1, "°C")}</span>
      <span className="s3d-haze">P-Trak {ptrak(reading(e, "ptrak_per_cc", t))}</span>
      <span className="s3d-mass">mass {num(mass, 3, "mg/m³")}</span>
      <span>{cell(e.test.material)}</span>
      <span>Rt/R0 {cell(e.test.heater_rt_r0)}</span>
      <span>inlet {cell(e.test.inlet_velocity_cm_s, " cm/s")}</span>
      {toggle("haze", "haze")}
      {toggle("detectors", "detectors")}
      {toggle("apparatus", "apparatus")}
    </div>
  );
}

/** One line saying what is happening at the cursor. Heater state comes from the `heating` column. */
export function Phase({ experiment: e, playback }: Props) {
  const { t } = usePlayback(playback);
  // every phrase below restates a telemetry column; nothing here is inferred from the procedure
  const p = reading(e, "ptrak_per_cc", t);
  const counting = p != null && p > 0;
  const count = counting ? "the P-Trak is counting particles" : "no particles at the P-Trak yet";
  if (t < 0) return <>Before heating · {counting ? count : "the P-Trak counts no particles"}</>;
  if (heaterOn(e, t)) return <span className="s3d-live">Heater on, no flame · {count}</span>;
  if (p != null && p >= PTRAK_LIMIT) return <span className="s3d-live">P-Trak at its upper limit · the real count is higher</span>;
  if (counting) return <span className="s3d-live">Heater off · {count}</span>;
  const later = e.ptrakPeak != null && t < e.ptrakPeak.t;
  return <>Heater off · {later ? count : "the P-Trak counts no particles"}</>;
}

const logPos = (v: number) => `${(massFraction(v) * 100).toFixed(1)}%`;

/** Right column: detector signals in volts, the smoke-mass scale with the reference alarm level, TEM archives. */
export function Instruments({ experiment: e, playback, layers }: Props & { layers: Layers }) {
  const { t } = usePlayback(playback);
  const mass = e.hasMass ? reading(e, "dusttrak_b_mg_m3", t) : null;
  return (
    <aside className="s3d-side">
      <h3 className="s3d-title mono">Smoke detectors</h3>
      {!layers.detectors ? (
        <p className="s3d-note">Layer hidden.</p>
      ) : e.detectors.length === 0 ? (
        <p className="s3d-note">No detector signal changed in this test.</p>
      ) : (
        e.detectors.map((d) => {
          const v = reading(e, d.col, t);
          const raw = detectorChange(d, v);
          const change = raw == null ? null : Number(raw.toFixed(3)) + 0; // + 0: no "−0.000"
          return (
            <div key={d.col} className="s3d-gauge mono">
              <span>{d.label}</span>
              <span>{num(v, 3, "V")}</span>
              <span className="s3d-delta">
                {change == null ? (v == null ? NO_DATA : "no signal") : `change ${change < 0 ? "−" : "+"}${Math.abs(change).toFixed(3)} V`}
              </span>
              <div className="s3d-bar" aria-hidden="true">
                <div style={{ width: `${(detectorFraction(d, v) * 100).toFixed(1)}%` }} />
              </div>
            </div>
          );
        })
      )}
      <p className="s3d-note">
        Volts as recorded. Change (estimate): difference from the median level before heating. Every bar uses the same
        scale in every test: a full bar is a {DETECTOR_FULL_SCALE_V} V change, so a weak response looks weak. Detector
        types put out different voltages; compare a detector with itself across tests. “No signal”: a detector that
        normally rests above 1 V reads 0 V. No alarm threshold in volts is given in the NASA data, so none is drawn.
      </p>

      <h3 className="s3d-title mono">Smoke mass · DustTrak B</h3>
      <div className="s3d-gauge mono">
        <span>log scale, mg/m³</span>
        <span>{num(mass, 3, "mg/m³")}</span>
        <div className="s3d-bar s3d-mass-bar" aria-hidden="true">
          {mass != null && mass > 0 && <div style={{ width: logPos(mass) }} />}
          <i style={{ left: logPos(MASS_ALARM_MG_M3) }} />
        </div>
        <span className="s3d-axis">
          <span>0.01</span>
          <span>1000</span>
        </span>
      </div>
      <p className="s3d-note">
        Marker: reference alarm level {MASS_ALARM_MG_M3} mg/m³ for smoke with 500 nm count median diameter (SAME-2
        “Comparison of Flight and Ground Test Results”, slides 25–26). It is a reference for this scale, not a detector
        setting.
      </p>

      <h3 className="s3d-title mono">TEM images</h3>
      {e.tem.length === 0 ? (
        <p className="s3d-note">No TEM archive for this test.</p>
      ) : (
        <>
          <p className="s3d-note">TEM images: not loaded yet. Archives in PSI for this test:</p>
          <ul className="s3d-files mono">
            {e.tem.map((a) => (
              <li key={a.name}>
                {a.aging ? `${a.aging}-age · ` : ""}
                {a.name.replace(/^PSI-101_Raw Data_/, "")}
              </li>
            ))}
          </ul>
        </>
      )}
      {e.doi && (
        <a className="s3d-link mono" href={e.doi.url} target="_blank" rel="noreferrer">
          [ dataset in PSI ]
        </a>
      )}
    </aside>
  );
}
