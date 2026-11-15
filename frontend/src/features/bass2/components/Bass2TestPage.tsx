import { useState } from "react";
import { Link } from "react-router";
import { TimeChart, type Point } from "@/shared/ui/chart/TimeChart";
import { apiHref, testHref, useBass2Test } from "../api";
import { outcomeStyle } from "../lib/outcomes";
import type { FileItem, PsiVideo, TestDetail, VideoSeries } from "../types";
import { OutcomeMark } from "./Glyph";
import "./bass2.css";

const fmt = (v: number | null | undefined, d = 1, unit = "") => (v == null ? "—" : `${v.toFixed(d)}${unit}`);
const mb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(0.1, b / 1e6).toFixed(1)} MB`);

/** One BASS-II test: conditions, researchers' notes, video and (for some tests) time series from the video. */
export function Bass2TestPage({ id }: { id: string }) {
  const q = useBass2Test(id);
  if (q.isPending) {
    return (
      <div className="wrap band">
        <p className="muted mono">Loading test {id}…</p>
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="wrap band">
        <p className="placeholder" role="alert">
          Could not load test {id} ({q.error.message}).
        </p>
        <Link className="btn ghost" to="/studies/bass2/tests">
          ← All tests
        </Link>
      </div>
    );
  }
  return <Report d={q.data} />;
}

function Report({ d }: { d: TestDetail }) {
  const t = d.test;
  const log = d.log;
  const reportSource = d.sources.find((s) => s.url.includes("Summary%20Report"));
  return (
    <div className="b2t">
      <section className="band">
        <div className="wrap">
          <p className="b2-kicker mono">
            <Link to="/studies/bass2/tests">BASS-II tests</Link> · {t.pi} · {t.test_date ?? "date unknown"}
            {t.gmt_day != null && ` · GMT day ${t.gmt_day}`}
          </p>
          <h1 className="h-display">
            {t.test_id} <span className="b2t-sub">{t.material}</span>
          </h1>
          <div className="b2t-outcome">
            <OutcomeMark outcome={t.outcome} long />
            <span className="tag">derived</span>
            {log?.outcome_confidence === "medium" && <span className="muted small">ambiguous wording in the log</span>}
            {!log && <span className="muted small">this test is not in the report log</span>}
          </div>
          <div className="stats b2t-stats">
            <Stat value={`${fmt(t.o2_initial_pct)} → ${t.o2_final_suspect ? "?" : fmt(t.o2_final_pct)}`} label="O₂ start → end, % vol" />
            <Stat value={`${fmt(t.co2_initial_pct, 2)} → ${fmt(t.co2_final_pct, 2)}`} label="CO₂ start → end, % vol" />
            <Stat
              value={`${fmt(t.co_initial_ppm, 0)} → ${t.co_over_range ? "over range" : fmt(t.co_final_ppm, 0)}`}
              label="CO start → end, ppm"
            />
            <Stat value={t.flow_config ?? "—"} label={log?.flow_config_derived ? "flow geometry (restored)" : "flow geometry"} />
          </div>
          {t.o2_final_suspect && (
            <p className="small b2x-flag">
              The final O₂ in the source table ({fmt(t.o2_final_pct)}%) is physically impossible and is not shown.
            </p>
          )}
        </div>
      </section>

      {log?.observations && (
        <section className="band" aria-labelledby="b2t-notes">
          <div className="wrap b2-narrow">
            <h2 id="b2t-notes" className="h-section">What the researchers wrote</h2>
            <blockquote className="b2-quote b2t-quote">“{log.observations}”</blockquote>
            <p className="mono small muted">
              Appendix A, Table {log.table}, NASA/TM-20210011385 p. {log.report_page}
              {reportSource && (
                <>
                  {" · "}
                  <a href={apiHref(reportSource.url)} target="_blank" rel="noreferrer">
                    open the page ↗
                  </a>
                </>
              )}
            </p>
            {log.outcome_note && (
              <p className="small">
                <span className="tag">derived</span> We read the outcome as “{outcomeStyle(log.outcome).label.toLowerCase()}”: {log.outcome_note}.
              </p>
            )}
          </div>
        </section>
      )}

      <Media d={d} />

      <section className="band" aria-labelledby="b2t-cond">
        <div className="wrap">
          <h2 id="b2t-cond" className="h-section">Conditions as logged</h2>
          <dl className="kv b2t-kv">
            <dt>Sample no.</dt>
            <dd>{d.sample_no ?? "—"}</dd>
            <dt>Flow restrictors</dt>
            <dd>{t.flow_restrictor ?? "—"} (0 = most flow, 2 = least)</dd>
            <dt>Fan steps</dt>
            <dd>{d.fan_display ?? "—"}</dd>
            <dt>Air display, cm/s</dt>
            <dd>{d.air_display ?? "—"}</dd>
            <dt>Radiometer gain</dt>
            <dd>{d.radiometer_gain ?? "—"}</dd>
            {log?.time_raw && (
              <>
                <dt>Start → end (video clock)</dt>
                <dd>{log.time_raw}</dd>
              </>
            )}
            {log?.igniter && (
              <>
                <dt>Igniter</dt>
                <dd>{log.igniter}</dd>
              </>
            )}
            <dt>Nikon frames</dt>
            <dd>{d.total_frames ?? d.frames_note ?? "—"}</dd>
          </dl>
          <p className="small muted">
            Fan steps are free text from the source: fan display ×10 V or potentiometer setting. The air
            sensor responds in about a minute, so its value holds only on long steady steps.
          </p>
          {d.pi_table && <PiTable row={d.pi_table} testId={t.test_id} />}
        </div>
      </section>

      <section className="band" aria-labelledby="b2t-files">
        <div className="wrap">
          <h2 id="b2t-files" className="h-section">Files</h2>
          <FileList files={d.files} />
          {d.psi_files.length > 0 && (
            <details>
              <summary>
                In NASA PSI only <span className="muted mono small">{d.psi_files.length} files</span>
              </summary>
              <ul className="b2t-files body">
                {d.psi_files.map((f) => (
                  <li key={f.name}>
                    <span className="mono small">{f.name.replace(/^PSI-25_Raw Data_/, "")}</span>{" "}
                    <span className="muted small">
                      {f.kind.replace(/_/g, " ")} · {mb(f.bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {d.same_day.length > 0 && (
            <p className="small">
              Same day:{" "}
              {d.same_day.map((s, i) => (
                <span key={s}>
                  {i > 0 && " · "}
                  <Link className="mono" to={testHref(s)}>
                    {s}
                  </Link>
                </span>
              ))}
            </p>
          )}
          <p className="small muted">
            Sources:{" "}
            {d.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <a href={s.url.startsWith("http") ? s.url : apiHref(s.url)} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </span>
            ))}
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

type Clip = { key: string; label: string; src: string; size: number; psi: boolean; index?: number };

function Media({ d }: { d: TestDetail }) {
  const clips: Clip[] = [
    ...d.psi_videos.map((v: PsiVideo) => ({ key: `psi-${v.index}`, label: v.label, src: apiHref(v.url), size: v.bytes, psi: true, index: v.index })),
    ...d.videos.map((v: FileItem) => ({ key: v.url, label: "Clip stored with the site", src: apiHref(v.url), size: v.bytes, psi: false })),
  ];
  const series = d.video_series;
  const first = series?.psi_video_index != null ? `psi-${series.psi_video_index}` : clips[0]?.key;
  const [sel, setSel] = useState<string | undefined>(first);
  const [time, setTime] = useState<number | null>(null);
  const clip = clips.find((c) => c.key === sel);
  const synced = series != null && clip?.psi === true && clip.index === series.psi_video_index;

  return (
    <section className="band" aria-labelledby="b2t-media">
      <div className="wrap">
        <h2 id="b2t-media" className="h-section">Watch the burn</h2>
        {clips.length === 0 ? (
          <p className="placeholder">No video of this test in NASA PSI.</p>
        ) : (
          <div className="b2t-media">
            <figure className="b2t-video">
              {clip && (
                <video
                  key={clip.key}
                  src={clip.src}
                  controls
                  preload="metadata"
                  onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                  onSeeked={(e) => setTime(e.currentTarget.currentTime)}
                />
              )}
              <figcaption className="small muted">
                {clip?.psi
                  ? "Streams directly from NASA PSI and may buffer. The text overlay shows N₂ flow (FUEL), air speed, fan voltage ×10, radiometer and the GMT clock; the date is one day ahead (leap-year bug)."
                  : "Short clip stored with the site."}
              </figcaption>
            </figure>
            <ul className="b2t-clips">
              {clips.map((c) => (
                <li key={c.key}>
                  <button type="button" className={c.key === sel ? "on" : undefined} onClick={() => setSel(c.key)}>
                    <span>{c.label}</span>
                    <span className="mono small muted">
                      {c.psi ? "NASA PSI" : "site"} · {mb(c.size)}
                      {series?.psi_video_index === c.index && c.psi ? " · synced charts" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {series && <SeriesCharts s={series} cursor={synced ? time : null} synced={synced} />}
      </div>
    </section>
  );
}

function SeriesCharts({ s, cursor, synced }: { s: VideoSeries; cursor: number | null; synced: boolean }) {
  const col = (name: string) => s.columns.indexOf(name);
  const pts = (name: string, f: (v: number) => number = (v) => v): Point[] =>
    s.points.filter((p) => p[col(name)] != null).map((p) => [p[0] as number, f(p[col(name)] as number)]);
  const tmax = (s.points[s.points.length - 1]?.[0] as number) ?? 1;
  const x: [number, number] = [0, tmax];
  return (
    <div className="b2t-series">
      <h3>
        The test, second by second <span className="tag">estimate</span>
      </h3>
      <p className="small muted">
        Read from the data overlay of the NASA video by us (template OCR, 1 point per second), video
        clock starts {s.start_gmt} GMT. {synced ? "The blue line follows the video." : "Play the synced video to move the cursor."}
      </p>
      <div className="b2t-charts">
        <TimeChart
          ariaLabel="Air speed reading over time"
          series={[{ id: "air", label: "air display, cm/s", points: pts("air_cm_s"), kind: "line", tone: "ink" }]}
          xLabel="video time, s"
          yLabel="cm/s"
          xDomain={x}
          cursor={cursor}
          height={160}
        />
        <TimeChart
          ariaLabel="Fan display over time"
          series={[{ id: "fan", label: "fan display, ×10 V", points: pts("fan_display"), kind: "line", tone: "s1" }]}
          xLabel="video time, s"
          yLabel="×10 V"
          xDomain={x}
          cursor={cursor}
          height={160}
        />
        <TimeChart
          ariaLabel="Radiometer reading over time"
          series={[{ id: "rad", label: "radiometer, relative (uncalibrated)", points: pts("rad_rel"), kind: "line", tone: "dis" }]}
          xLabel="video time, s"
          yLabel="relative"
          xDomain={x}
          cursor={cursor}
          height={160}
        />
        <TimeChart
          ariaLabel="Flame visibility in the video over time"
          series={[
            {
              id: "scene",
              label: "bright pixels in the video, log₁₀ (flame visibility proxy)",
              points: pts("scene_px", (v) => Math.log10(v + 1)),
              kind: "dots",
              tone: "uv",
            },
          ]}
          xLabel="video time, s"
          yLabel="log₁₀ px"
          xDomain={x}
          cursor={cursor}
          height={160}
        />
      </div>
      <p className="small muted">{s.method}</p>
    </div>
  );
}

function FileList({ files }: { files: FileItem[] }) {
  if (!files.length) return <p className="small muted">No light files for this test in the snapshot.</p>;
  return (
    <ul className="b2t-files">
      {files.map((f) => (
        <li key={f.url}>
          <a href={apiHref(f.url)} target="_blank" rel="noreferrer">
            {f.kind}
          </a>{" "}
          <span className="muted small mono">
            {f.name} · {mb(f.bytes)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const PI_LABELS: Record<string, string> = {
  thickness_mm: "Thickness, mm",
  width_cm: "Width, cm",
  sides_burning: "Sides burning",
  velocities_cm_s: "Flow steps, cm/s",
  spread_rates_mm_s: "Spread rate, mm/s",
  burn_time_min: "Burn time, min",
  flow_start_cm_s: "Flow at start, cm/s",
  flow_end_cm_s: "Flow at end, cm/s",
  o2_pct: "O₂, % vol",
  comment: "PI verdict",
};

function PiTable({ row, testId }: { row: Record<string, unknown>; testId: string }) {
  const table = testId.startsWith("M") ? "Table 5.1 (Miller, p. 57)" : "Table 7.1 (T'ien, p. 96)";
  const entries = Object.entries(PI_LABELS).filter(([k]) => row[k] != null && row[k] !== "");
  return (
    <div className="b2t-pi">
      <h3>From the PI's own summary · {table}</h3>
      <dl className="kv">
        {entries.map(([k, label]) => (
          <div key={k} className="b2t-kv-row">
            <dt>{label}</dt>
            <dd>{Array.isArray(row[k]) ? (row[k] as number[]).join(" → ") : String(row[k])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
