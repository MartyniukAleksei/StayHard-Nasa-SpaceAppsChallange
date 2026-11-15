import { useState } from "react";
import { Link } from "react-router";
import { DETECTOR_LABELS, MASS_ALARM_MG_M3, particlesFirst, PTRAK_LIMIT, SameR3D } from "@/features/same-r-3d";
import { extent, TimeChart, type Marker, type Series, type Tone } from "@/shared/ui/chart/TimeChart";
import { apiUrl, useSameRSeries, useSameRTest, useTem } from "../api";
import { column, heaterOff, paramRows } from "../lib/tests";
import type { PageDetail, Row } from "../types";
import { compareHref, BASE_PATH, TESTS_PATH } from "../lib/compare";
import { FileLinks } from "./Common";
import "./same-r.css";

/** One SAME-R test: header, 3D replay, telemetry charts, table rows, TEM images, files. */
export function SameRTest({ testNo }: { testNo: number }) {
  const { data: t, isPending, isError, error } = useSameRTest(testNo);
  if (isPending) return <p className="wrap band muted mono">Loading test #{testNo}…</p>;
  if (isError || !t) {
    return (
      <div className="wrap band">
        <p className="placeholder" role="alert">
          {isError ? `Test #${testNo} could not be loaded (${error.message}).` : `There is no test #${testNo} in the SAME-R experiment table.`}
        </p>
        <Link className="btn" to={TESTS_PATH}>
          Back to all tests
        </Link>
      </div>
    );
  }
  const main = t.rows.find((r) => r.test_id === String(testNo)) ?? t.rows[0];
  return (
    <article className="wrap sr-test">
      <Header t={t} main={main} />
      <section className="sr-sec" aria-labelledby="sr-watch">
        <h2 id="sr-watch" className="h-section">Watch</h2>
        {main.has_timeseries ? (
          <SameR3D testNo={testNo} />
        ) : (
          <p className="placeholder">This test has no telemetry in the dataset, so there is nothing to watch and no charts.</p>
        )}
      </section>
      {main.has_timeseries && <Charts t={t} />}
      <Params main={main} aged={t.rows.find((r) => r.test_id === `${main.test_id}a`) ?? null} />
      {t.tem_archives.length > 0 && <Tem testNo={testNo} />}
      <section className="sr-sec sr-narrow" aria-labelledby="sr-files">
        <h2 id="sr-files" className="h-section">Files</h2>
        {t.files.length ? (
          <FileLinks files={t.files} />
        ) : (
          <p className="muted">No files for this test in the local snapshot.</p>
        )}
      </section>
    </article>
  );
}

function Header({ t, main }: { t: PageDetail; main: Row }) {
  const aged = t.rows.find((r) => r.test_id === `${main.test_id}a`);
  const twins = t.rows.filter((r) => r.test_id === main.test_id);
  const peak = t.coverage?.ptrak_peak_per_cc;
  return (
    <header className="sr-head">
      <p className="sr-kicker mono">
        <Link to={BASE_PATH}>SAME-R</Link> / <Link to={TESTS_PATH}>Tests</Link> / #{main.test_id}
      </p>
      <h1 className="h-display">
        Test #{main.test_id}: {main.material ?? "unknown material"}
        {main.description ? `, ${main.description}` : ""}
      </h1>
      <div className="sr-tags">
        {main.material && <span className="tag on">{main.material}</span>}
        {main.heater_rt_r0 != null && <span className="tag">heater Rt/R0 {main.heater_rt_r0}</span>}
        {aged && <span className="tag">aged row {aged.test_id}</span>}
      </div>
      <div className="sr-actions">
        <Link className="btn" to={compareHref([t.test_no])}>
          Compare with…
        </Link>
      </div>
      <ul className="sr-flags">
        {peak != null && peak >= PTRAK_LIMIT && (
          <li>The P-Trak reached its upper limit: the true particle count was at least this high.</li>
        )}
        {!main.has_timeseries && <li>No telemetry for this test in the dataset.</li>}
        {twins.length > 1 && (
          <li>
            The experiment table lists test {main.test_id} {twins.length} times ({twins.map((r) => r.material ?? "unknown").join(", ")}).
            The page uses the first row; the telemetry cannot tell which is right.
          </li>
        )}
      </ul>
    </header>
  );
}

const DETECTOR_TONES: Tone[] = ["ink", "s1", "s2", "ash", "ink"];

function Charts({ t }: { t: PageDetail }) {
  const { data: s, isPending } = useSameRSeries(t.test_no, true);
  if (isPending) return <p className="muted mono">Loading telemetry…</p>;
  if (!s) return null;
  const off = heaterOff(s);
  // one marker: "on" and "off" are ~60 s apart and their labels would overlap
  const markers: Marker[] = [{ x: 0, label: off != null ? `heater on 0–${off} s` : "heater on" }];
  const xDomain = extent([{ id: "t", points: column(s, "t_s").map(([x]) => [x, 0]) }], 0);
  const detectors = (t.coverage?.active_detectors ?? []).filter((c) => c in DETECTOR_LABELS);
  const mass: Series[] = [
    { id: "a", label: "DustTrak A", points: column(s, "dusttrak_a_mg_m3"), kind: "line", tone: "s1" },
    { id: "b", label: "DustTrak B", points: column(s, "dusttrak_b_mg_m3"), kind: "line" },
  ].filter((x) => x.points.length) as Series[];
  if (mass.length) {
    mass.push({ id: "alarm", label: `${MASS_ALARM_MG_M3} mg/m³ ref.`, points: [[xDomain[0], MASS_ALARM_MG_M3], [xDomain[1], MASS_ALARM_MG_M3]], kind: "line", tone: "ash" });
  }
  const det: Series[] = detectors.map((c, i) => ({ id: c, label: DETECTOR_LABELS[c].replace(" detector ·", ""), points: column(s, c), kind: "line", tone: DETECTOR_TONES[i] }));
  const [d0, d1] = extent(det, 1);
  const pad = (d1 - d0) * 0.05 || 0.1;
  return (
    <section className="sr-sec" aria-labelledby="sr-charts">
      <h2 id="sr-charts" className="h-section">Telemetry</h2>
      <p className="lede">1 Hz readings, {s.n_total} samples; t = 0 is heater on.</p>
      <div className="sr-charts">
        <Chart title="Particle count, P-Trak" series={[{ id: "p", label: "P-Trak", points: column(s, "ptrak_per_cc"), kind: "line", tone: "s2" }]} y="particles / cm³" x={xDomain} m={markers} n={t.test_no} />
        {mass.length > 0 ? (
          <Chart title="Smoke mass, DustTrak" series={mass} y="mg/m³" x={xDomain} m={markers} n={t.test_no} />
        ) : (
          <p className="placeholder">No valid DustTrak readings in this test.</p>
        )}
        <Chart title="Smoke temperature" series={[{ id: "c", label: "plume", points: column(s, "plume_c"), kind: "line" }]} y="°C" x={xDomain} m={markers} n={t.test_no} yDomain={paddedY(column(s, "plume_c"))} />
        {det.length > 0 && (
          <Chart title="Smoke detectors (active in this test)" series={det} y="volts" x={xDomain} m={markers} n={t.test_no} yDomain={[d0 - pad, d1 + pad]} />
        )}
      </div>
    </section>
  );
}

function paddedY(points: [number, number][]): [number, number] {
  const [a, b] = extent([{ id: "y", points }], 1);
  const pad = (b - a) * 0.05 || 1;
  return [a - pad, b + pad];
}

function Chart(p: { title: string; series: Series[]; y: string; x: [number, number]; m: Marker[]; n: number; yDomain?: [number, number] }) {
  return (
    <div>
      <h3>{p.title}</h3>
      <TimeChart series={p.series} xLabel="time, s" yLabel={p.y} xDomain={p.x} yDomain={p.yDomain} markers={p.m} ariaLabel={`${p.title} over time for SAME-R test ${p.n}`} />
    </div>
  );
}

function Params({ main, aged }: { main: Row; aged: Row | null }) {
  return (
    <section className="sr-sec" aria-labelledby="sr-params">
      <h2 id="sr-params" className="h-section">Parameters</h2>
      {aged && (
        <p className="lede">
          The smoke was measured again after aging (table row {aged.test_id}); its values are shown where they differ.
        </p>
      )}
      <dl className="sr-kv">
        {paramRows(main, aged).map((r) => [
          <dt key={`${r.label}-k`}>{r.label}</dt>,
          <dd key={`${r.label}-v`}>
            {r.value}
            {r.aged && <span className="muted"> · after aging ({aged?.test_id}): {r.aged}</span>}
          </dd>,
        ])}
      </dl>
    </section>
  );
}

function Tem({ testNo }: { testNo: number }) {
  const { data, isPending, isError, error } = useTem(testNo);
  return (
    <section className="sr-sec" aria-labelledby="sr-tem">
      <h2 id="sr-tem" className="h-section">Particles under the microscope</h2>
      <p className="lede">TEM images of smoke particles from this test, from NASA PSI.</p>
      {isPending && <p className="muted mono" role="status">Loading from NASA PSI…</p>}
      {isError && <p className="placeholder" role="alert">TEM images could not be loaded ({error.message}).</p>}
      {data?.archives.map((a) => (
        <div key={a.psi_file}>
          <h3 className="sr-sub">
            {[a.aging === "pre" ? "fresh smoke" : a.aging === "post" ? "aged smoke" : null, a.sample_id && `sample ${a.sample_id}`].filter(Boolean).join(" · ") || "images"}
          </h3>
          <TemGrid images={particlesFirst(a.images)} testNo={testNo} />
        </div>
      ))}
    </section>
  );
}

// each image is one read from NASA PSI (1–4 s), so the gallery asks for a few at a time
const PAGE = 6;

function TemGrid({ images, testNo }: { images: { name: string; url: string }[]; testNo: number }) {
  const [n, setN] = useState(PAGE);
  return (
    <>
      <ul className="sr-tem-grid">
        {images.slice(0, n).map((im) => (
          <li key={im.url}>
            <a href={apiUrl(im.url)} target="_blank" rel="noreferrer">
              <img src={apiUrl(`${im.url}?max_side=320`)} alt={`TEM image ${im.name}, test ${testNo}`} loading="lazy" />
              {im.name}
            </a>
          </li>
        ))}
      </ul>
      {n < images.length && (
        <button type="button" className="btn ghost" onClick={() => setN(n + PAGE)}>
          Show {Math.min(PAGE, images.length - n)} more of {images.length - n}
        </button>
      )}
    </>
  );
}
