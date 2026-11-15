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
import { apiUrl, useTem } from "../api";
import { particlesFirst } from "../lib/tem.ts";
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
      <div className="s3d-layers" role="group" aria-label="Scene layers">
        {toggle("haze", "haze")}
        {toggle("detectors", "detectors")}
        {toggle("apparatus", "apparatus")}
      </div>
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
        Change from before heating (estimate). Full bar = {DETECTOR_FULL_SCALE_V} V. No alarm level in volts in the data.
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
      <p className="s3d-note">Blue mark: {MASS_ALARM_MG_M3} mg/m³ reference alarm level (SAME-2 slides 25–26).</p>

      <h3 className="s3d-title mono">Real particles · TEM</h3>
      {e.tem.length === 0 ? <p className="s3d-note">No TEM images for this test.</p> : <TemStrip testNo={e.test.test_no} />}
      {e.doi && (
        <a className="s3d-link mono" href={e.doi.url} target="_blank" rel="noreferrer">
          [ dataset in PSI ]
        </a>
      )}
    </aside>
  );
}

/** The real experiment next to the scene: first TEM image of each archive (fresh / aged smoke), from NASA PSI. */
function TemStrip({ testNo }: { testNo: number }) {
  const { data, isPending, isError } = useTem(testNo);
  if (isPending) return <p className="s3d-note">Loading from NASA PSI…</p>;
  if (isError) return <p className="s3d-note">NASA PSI did not answer.</p>;
  const firsts = data.archives.flatMap((a) => {
    const im = particlesFirst(a.images)[0];
    return im ? [{ a, im }] : [];
  });
  return (
    <ul className="s3d-tem">
      {firsts.map(({ a, im }) => (
        <li key={im.url}>
          <a href={apiUrl(im.url)} target="_blank" rel="noreferrer">
            <img src={apiUrl(`${im.url}?max_side=320`)} alt={`TEM image ${im.name}`} loading="lazy" />
            <span className="mono">{a.aging === "post" ? "aged smoke" : a.aging === "pre" ? "fresh smoke" : (a.sample_id ?? "sample")}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
