import { Link } from "react-router";
import {
  compareHref,
  seriesCsvUrl,
  testHref,
  useTest,
  type TestDetail,
} from "@/features/flex-tests";
import { useReplay } from "@/features/replay";
import { chem, fiberLabel, num, pct } from "@/shared/lib/format";
import { TimeChart } from "@/shared/ui/chart/TimeChart";
import { EndMark } from "@/shared/ui/EndMark";
import { fitD2, fitLine, findGaps } from "../lib/d2fit";
import { D2Explainer } from "./D2Explainer";
import { FileList } from "./FileList";
import { MediaBlock } from "./MediaBlock";
import { WhatHappened } from "./WhatHappened";
import "./test.css";

/** 3A: a long report, top to bottom, like Summary.pdf but in the browser. */
export function TestReport({ testNo }: { testNo: number }) {
  const { data: t, isPending, isError, error } = useTest(testNo);
  if (isPending) return <p className="wrap band muted mono">Loading test #{testNo}…</p>;
  if (isError) {
    return (
      <div className="wrap band">
        <p className="placeholder" role="alert">
          Test #{testNo} could not be loaded ({error.message}).
        </p>
        <Link className="btn" to="/studies/flex/tests">
          Back to all tests
        </Link>
      </div>
    );
  }
  return (
    <article className="wrap tp">
      <Header t={t} />
      <WhatHappened comment={t.comment} files={t.files} />
      <section className="tp-sec" aria-labelledby="tp-media">
        <h2 id="tp-media" className="h-section">Watch</h2>
        <MediaBlock t={t} />
      </section>
      {t.has_series ? <Charts t={t} /> : <NoSeries />}
      <Params t={t} />
      <Neighbors t={t} />
      <section className="tp-sec" aria-labelledby="tp-files">
        <h2 id="tp-files" className="h-section">Files</h2>
        <FileList files={t.files} extra={{ name: `flex-${String(t.test_no).padStart(3, "0")}-series.csv`, href: seriesCsvUrl(t.test_no), kind: "Measured series from our database (CSV)" }} />
      </section>
    </article>
  );
}

function Header({ t }: { t: TestDetail }) {
  return (
    <header className="tp-head">
      <p className="ov-kicker mono">
        <Link to="/studies/flex">FLEX</Link> / <Link to="/studies/flex/tests">Tests</Link> / #{t.test_no}
      </p>
      <h1 className="h-display">
        Test #{t.test_no}: {t.fuel}, {pct(t.x_o2)} O₂ in {chem(t.diluent)} at {num(t.p_atm, 2, "atm")}
      </h1>
      <div className="tp-tags">
        <span className="tag on">
          <EndMark type={t.end_type} />
        </span>
        <span className="tag">{fiberLabel(t.fiber)}</span>
        {t.cool_flame && <span className="tag">cool flame mentioned · derived</span>}
      </div>
      <ul className="tp-flags">
        {t.end_type === "Disruption" && <li>Disruption: self-extinction was not observed. It does not mean the flame would burn forever.</li>}
        {t.fiber !== false && <li>{t.fiber ? "Fiber-supported droplet" : "Fiber status unknown"}: do not mix with free-floating droplets.</li>}
        {t.d0_mm == null && <li>Initial diameter d₀ is missing in the data.</li>}
        {t.k_mm2_s == null && <li>Burning-rate constant K is missing in the data.</li>}
      </ul>
      <div className="tp-actions">
        <Link className="btn" to={compareHref([t.test_no])}>
          Compare with…
        </Link>
      </div>
    </header>
  );
}

function Charts({ t }: { t: TestDetail }) {
  const { data } = useReplay(t.test_no);
  if (!data) return <p className="muted mono">Loading series…</p>;
  const d2 = data.droplet.map(([s, d]) => [s, d * d] as [number, number]);
  const flameOut = t.burn_time_s ? [{ x: t.burn_time_s, label: "flame out" }] : [];
  const fit = fitD2(d2, t.burn_time_s);
  const gaps = findGaps(data.droplet.map(([s]) => s));
  return (
    <>
      <section className="tp-sec" aria-labelledby="tp-d2">
        <h2 id="tp-d2" className="h-section">Droplet: the d² law</h2>
        <p className="lede">While the droplet burns steadily, its squared diameter falls on a straight line.</p>
        <TimeChart
          series={[
            { id: "d2", label: "d² measured", points: d2 },
            ...(fit ? [{ id: "fit", label: "linear fit (our estimate)", points: fitLine(fit), kind: "dashed" as const }] : []),
          ]}
          xLabel="time, s"
          yLabel="d², mm²"
          ariaLabel={`Droplet diameter squared over time for test ${t.test_no}`}
          markers={flameOut}
          gaps={gaps}
          legendExtra={gaps.length ? [{ id: "gap", label: "no measurements", swatch: "band" }] : []}
        />
        <D2Explainer fit={fit} nasaK={t.k_mm2_s} d0={t.d0_mm} gaps={gaps} />
      </section>
      <section className="tp-sec" aria-labelledby="tp-flame">
        <h2 id="tp-flame" className="h-section">Flame and droplet diameter</h2>
        <TimeChart
          series={[
            { id: "flame", label: "flame", points: data.flame, tone: "flame" },
            { id: "drop", label: "droplet", points: data.droplet },
          ]}
          xLabel="time, s"
          yLabel="diameter, mm"
          ariaLabel={`Flame and droplet diameter over time for test ${t.test_no}`}
          markers={flameOut}
        />
      </section>
    </>
  );
}

function NoSeries() {
  return (
    <section className="tp-sec">
      <h2 className="h-section">Measured series</h2>
      <p className="placeholder">This test has no droplet and flame time series in the dataset, so there are no charts.</p>
    </section>
  );
}

function Params({ t }: { t: TestDetail }) {
  const rows: [string, string][] = [
    ["CIR identifier", t.cir_id ?? "—"],
    ["Date, GMT", `${t.test_date ?? "—"} ${t.test_gmt ?? ""}`],
    ["Fuel", t.fuel],
    ["Pressure", num(t.p_atm, 3, "atm")],
    ["O₂ / N₂ / CO₂ / He", [t.x_o2, t.x_n2, t.x_co2, t.x_he].map(pct).join(" / ")],
    ["Initial diameter d₀", num(t.d0_mm, 2, "mm")],
    ["Extinction diameter d_ext", num(t.dext_mm, 2, "mm")],
    ["Burning-rate constant K", num(t.k_mm2_s, 2, "mm²/s")],
    ["Burn time", num(t.burn_time_s, 1, "s")],
    ["Ambient temperature", num(t.temperature_k, 1, "K")],
    ["Droplet", fiberLabel(t.fiber)],
    ["End", t.end_type],
  ];
  return (
    <section className="tp-sec" aria-labelledby="tp-params">
      <h2 id="tp-params" className="h-section">Parameters</h2>
      <dl className="kv tp-kv">
        {rows.map(([k, v]) => (
          <div key={k} className="tp-kv-row">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Neighbors({ t }: { t: TestDetail }) {
  return (
    <section className="tp-sec" aria-labelledby="tp-nb">
      <h2 id="tp-nb" className="h-section">Similar tests</h2>
      <p className="lede">
        <span className="tag">derived</span> Same fuel ({t.fuel}), diluent ({chem(t.diluent)}) and droplet class ({fiberLabel(t.fiber)}); closest by O₂, pressure and d₀.
      </p>
      {t.neighbors.length === 0 ? (
        <p className="muted">No other test shares these conditions.</p>
      ) : (
        <div className="tp-nb-wrap">
          <table className="tp-nb">
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">O₂</th>
                <th scope="col">Pressure</th>
                <th scope="col">Initial diameter</th>
                <th scope="col">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {t.neighbors.map((n) => (
                <tr key={n.test_no}>
                  <td>
                    <Link to={testHref(n.test_no)} className="mono">
                      #{n.test_no}
                    </Link>
                  </td>
                  <td className="mono">{pct(n.x_o2)}</td>
                  <td className="mono">{num(n.p_atm, 2, "atm")}</td>
                  <td className="mono">{num(n.d0_mm, 2, "mm")}</td>
                  <td>
                    <EndMark type={n.end_type} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
