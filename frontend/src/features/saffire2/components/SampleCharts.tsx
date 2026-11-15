import { num } from "@/shared/lib/format";
import { TimeChart, type Series as ChartSeries, type Tone } from "@/shared/ui/chart/TimeChart";
import { useSaffireSeries } from "../api";
import { domain, peakOf, points, toPpm } from "../lib/series";
import type { Series } from "../types";
import { Heatmap } from "./Heatmap";

const TONES: Tone[] = ["ink", "s1", "ash", "s2", "ink", "s1"];
export const SAMPLE_TC = ["TC7", "TC8", "TC9", "TC10", "TC11", "TC12"];
// Two thermocouples per sample (A nearer the igniter, B further). The six channels are shared by
// the three samples of a card row; which pair belongs to which column is inferred from the channels
// that respond in burning samples of that column (2-4/2-7 → TC10, TC9; 2-5/2-8 → TC7, TC8;
// 2-6/2-9 → TC11, TC12) and from the order of their peaks. Estimate: the spec table is not in PSI.
const TC_PAIR_BY_COLUMN: [number, number][] = [[3, 2], [0, 1], [4, 5]];
export const tcPair = (id: string) => TC_PAIR_BY_COLUMN[(Number(id.split("-")[1]) - 1) % 3];
const PLUME_TC = ["TC1", "TC2", "TC3", "TC4", "TC5", "TC6"];
const IGNITION = [{ x: 0, label: "ignition" }];
// Readme Table 1 gives 30 cm/s for samples 6 and 9; the PSI experiment table says 20.
export const README_FLOW_30 = new Set(["2-6", "2-9"]);

/** Lines for several channels; only channels that respond (range > minRise) get an end label,
 * flat ones are listed in the caption instead, so labels do not pile up at the baseline. */
function lines(t: number[], rows: (number | null)[][], labels: string[], minRise: number) {
  const flat: string[] = [];
  const series: ChartSeries[] = rows.map((r, i) => {
    const [lo, hi] = domain(r, 0);
    const responds = hi - lo > minRise;
    if (!responds) flat.push(labels[i]);
    return { id: labels[i], points: points(t, r), kind: "line", tone: responds ? TONES[i % TONES.length] : "s2" };
  });
  // labels sit at each responding channel's peak (a one-point series), not at the line end
  const peaks: ChartSeries[] = series
    .filter((x) => !flat.includes(x.id))
    .map((x) => ({ id: `${x.id}-peak`, label: x.id, points: [peakOf(x.points)], kind: "dots", tone: x.tone }));
  return { series: [...series, ...peaks], flat };
}

const FlatNote = ({ flat, what }: { flat: string[]; what: string }) =>
  flat.length ? <p className="muted small">Flat (dark grey, no response above {what}): {flat.join(", ")}.</p> : null;

/** All sensor charts of one sample; `cursor` (s from ignition) comes from the 3D scene. */
export function SampleCharts({ id, cursor }: { id: string; cursor: number | null }) {
  const q = useSaffireSeries(id);
  if (q.isPending) return <p className="muted mono">Loading sample {id}…</p>;
  if (q.isError) {
    return (
      <p className="placeholder" role="alert">
        Could not load the sensors of sample {id} ({q.error.message}).
      </p>
    );
  }
  return <Charts s={q.data} cursor={cursor} />;
}

function Charts({ s, cursor }: { s: Series; cursor: number | null }) {
  const { t } = s;
  const co2ppm = s.co2_pct.map(toPpm);
  const co2 = domain(co2ppm, 0.1);
  const o2 = domain(s.o2_pct, 0.1);
  const rad = domain(s.radiometers.flat(), 0.08);
  const flow = domain([...s.anemometer_1, ...s.anemometer_2, 0], 0.08);
  const pair = tcPair(s.test_id);
  const pairRows = pair.map((i) => s.sample_tc[i]);
  const pairLabels = [`A ${SAMPLE_TC[pair[0]]}`, `B ${SAMPLE_TC[pair[1]]}`];
  const stc = lines(t, pairRows, pairLabels, 25);
  const ptc = lines(t, s.plume_tc, PLUME_TC, 5);
  const rds = lines(t, s.radiometers, ["R1", "R2", "R3", "R4"], 5);
  return (
    <div className="sf-charts">
      <figure className="sf-fig sf-wide">
        <figcaption>
          <h3>
            Flame over the sample thermocouples <span className="tag sf-derived">estimate</span>
          </h3>
          <p className="muted small">
            Two thermocouples sit on each sample: A nearer the igniter, B further along. Brighter means hotter; a row
            lights up when the flame reaches it. Which two of the six channels belong to this sample is inferred from
            burning samples in the same card column (the hardware spec table is not in PSI).
          </p>
        </figcaption>
        <Heatmap t={t} rows={pairRows} labels={pairLabels} unit="°C" cursor={cursor} />
      </figure>
      <figure className="sf-fig sf-wide">
        <figcaption><h3>Sample temperature</h3><FlatNote flat={stc.flat} what="25 °C" /></figcaption>
        <TimeChart series={stc.series} markers={IGNITION} cursor={cursor} xLabel="s from ignition" yLabel="°C" ariaLabel="Sample thermocouple temperatures over time" height={260} />
      </figure>
      <figure className="sf-fig">
        <figcaption><h3>CO₂</h3><p className="muted small">Rises when material burns. Sensor reads %, shown in ppm (1% = 10 000 ppm).</p></figcaption>
        <TimeChart series={[{ id: "co2", label: "CO₂", points: points(t, co2ppm), tone: "ink" }]} markers={IGNITION} cursor={cursor} yDomain={co2} xLabel="s from ignition" yLabel="ppm" ariaLabel="CO2 over time" />
      </figure>
      <figure className="sf-fig">
        <figcaption><h3>O₂ (sensor)</h3><p className="muted small">Measured; differs from the table value derived from CO₂.</p></figcaption>
        <TimeChart series={[{ id: "o2", label: "O₂", points: points(t, s.o2_pct), tone: "ash" }]} markers={IGNITION} cursor={cursor} yDomain={o2} xLabel="s from ignition" yLabel="%" ariaLabel="O2 over time" />
      </figure>
      <figure className="sf-fig">
        <figcaption>
          <h3>Radiometers <span className="tag sf-derived">derived</span></h3>
          <p className="muted small">Pre-ignition offset removed (baseline {s.radiometer_baseline.map((b) => num(b, 1)).join(" / ")} mW/cm²).</p>
        </figcaption>
        <FlatNote flat={rds.flat} what="5 mW/cm²" />
        <TimeChart series={rds.series} markers={IGNITION} cursor={cursor} yDomain={rad} xLabel="s from ignition" yLabel="mW/cm²" ariaLabel="Radiometers over time" />
      </figure>
      <figure className="sf-fig">
        <figcaption><h3>Plume thermocouples</h3><p className="muted small">Gas above the sample. Weak evidence: see Library → Limitations.</p><FlatNote flat={ptc.flat} what="5 °C" /></figcaption>
        <TimeChart series={ptc.series} markers={IGNITION} cursor={cursor} xLabel="s from ignition" yLabel="°C" ariaLabel="Plume thermocouple temperatures over time" />
      </figure>
      <figure className="sf-fig">
        <figcaption><h3>Igniter current</h3><p className="muted small">The hot wire that lights the sample; it sets t = 0.</p></figcaption>
        <TimeChart series={[{ id: "ign", label: "A", points: points(t, s.igniter_a), kind: "line", tone: "ink" }]} markers={IGNITION} cursor={cursor} xLabel="s from ignition" yLabel="A" ariaLabel="Igniter current over time" />
      </figure>
      <figure className="sf-fig">
        <figcaption><h3>Duct air flow</h3><p className="muted small">Two anemometers: the flow the flame lives on.</p></figcaption>
        <TimeChart
          series={[
            { id: "a1", label: "A1", points: points(t, s.anemometer_1), tone: "ink" },
            { id: "a2", label: "A2", points: points(t, s.anemometer_2), tone: "s2" },
          ]}
          markers={IGNITION} cursor={cursor}
          yDomain={[0, flow[1]]}
          xLabel="s from ignition"
          yLabel="cm/s"
          ariaLabel="Duct air flow over time"
        />
      </figure>
    </div>
  );
}
