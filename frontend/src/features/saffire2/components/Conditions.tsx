import { num } from "@/shared/lib/format";
import { TimeChart, type Tone } from "@/shared/ui/chart/TimeChart";
import { domain, toPpm } from "../lib/series";
import type { Dashboard } from "../types";

/** Data quality (Library): were the conditions the same for every sample? Plus module CO₂ over the series. */
export function Conditions({ data }: { data: Dashboard }) {
  const { samples, co2_timeline } = data;
  const flowMax = Math.max(1, ...samples.map((s) => (s.sensors?.flow_mean_cm_s ?? 0) + (s.sensors?.flow_sd_cm_s ?? 0)));
  const fanMax = Math.max(1, ...samples.map((s) => s.sensors?.fan_rpm_mean ?? 0));
  const tones: Tone[] = ["ink", "ash"];
  const tracks = co2_timeline.map((c) => ({ id: c.test_id, points: c.points.map(([m, v]) => [m, toPpm(v) ?? 0] as [number, number]) }));
  const co2 = domain(tracks.flatMap((c) => c.points.map((p) => p[1])), 0.06);
  return (
    <div className="sf-cond">
        <p className="lede">
          Were the conditions the same for every sample? 
          Validity check: duct flow, fan speed, pressure and humidity per sample. All values here
          are means over each recording <span className="tag sf-derived">derived</span>
        </p>
        <div className="sf-two">
          <div>
            <h3>Duct flow (anemometer 1), mean ± sd</h3>
            <ul className="sf-hbars" role="list">
              {samples.map((s) => {
                const m = s.sensors?.flow_mean_cm_s ?? null;
                const sd = s.sensors?.flow_sd_cm_s ?? null;
                return (
                  <li key={s.test_id}>
                    <span className="mono">{s.test_id}</span>
                    <span className="sf-track" aria-hidden="true">
                      <i style={{ width: `${m == null ? 0 : (m / flowMax) * 100}%` }} />
                      {m != null && sd != null && (
                        <b className="sf-whisker" style={{ left: `${((m - sd) / flowMax) * 100}%`, width: `${((2 * sd) / flowMax) * 100}%` }} />
                      )}
                    </span>
                    <span className="mono">{num(m, 1)} ± {num(sd, 1, "cm/s")}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h3>Duct fan speed, mean</h3>
            <ul className="sf-hbars" role="list">
              {samples.map((s) => {
                const v = s.sensors?.fan_rpm_mean ?? null;
                return (
                  <li key={s.test_id}>
                    <span className="mono">{s.test_id}</span>
                    <span className="sf-track" aria-hidden="true">
                      <i style={{ width: `${v == null ? 0 : (v / fanMax) * 100}%` }} />
                    </span>
                    <span className="mono">{num(v, 0, "rpm")}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="sf-table-wrap">
          <table className="sf-table">
            <caption className="muted small">Ambient conditions per sample (sensor means)</caption>
            <thead>
              <tr>
                <th scope="col">sample</th>
                <th scope="col">pressure</th>
                <th scope="col">humidity</th>
                <th scope="col">inlet air T</th>
                <th scope="col">O₂ sensor</th>
                <th scope="col">O₂ table (Note 1)</th>
                <th scope="col">recording</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => (
                <tr key={s.test_id}>
                  <th scope="row" className="mono">{s.test_id}</th>
                  <td>{num(s.sensors?.pressure_mean_psia, 2, "psia")}</td>
                  <td>{num(s.sensors?.humidity_mean_pct, 1, "%")}</td>
                  <td>{num(s.sensors?.inlet_t_mean_c, 1, "°C")}</td>
                  <td>{num(s.sensors?.o2_mean_pct, 2, "%")}</td>
                  <td>{s.o2_pct_table == null ? "range in table" : num(s.o2_pct_table, 1, "%")}</td>
                  <td>{num(s.sensors?.duration_s, 0, "s")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <figure className="sf-fig sf-wide">
          <figcaption>
            <h3>CO₂ in the module across the whole series</h3>
            <p className="muted small">
              The nine tests ran back to back in a closed module, so each burn leaves its CO₂ for
              the next. Steps on the thick PMMA samples are the largest.
            </p>
          </figcaption>
          <TimeChart
            series={tracks.map((c, i) => ({ id: c.id, label: c.id, points: c.points, tone: tones[i % 2] }))}
            yDomain={co2}
            xLabel="minutes from the start of the series"
            yLabel="CO₂, ppm"
            ariaLabel="CO2 in the module across all nine tests"
            height={260}
          />
        </figure>
    </div>
  );
}
