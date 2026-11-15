import { useId, useMemo, useState } from "react";
import { num, pct } from "@/shared/lib/format";
import { CopyButton } from "@/shared/ui/CopyButton";
import { Placeholder } from "@/shared/ui/Placeholder";
import { CALLOUTS_PAUSE, OBSERVATIONS, PASSPORT_STATIC, STAGES } from "../content";
import { ARCHIVE, ARCHIVE_FILE, FRAMES, HEIGHT, REFERENCE, SOURCE_SIZE, T_ZERO, TEST_ID, WIDTH } from "../frames";
import { MAX_STOPS, MIN_STOPS, gainFromStops, gainLabel } from "../lib/exposure";
import type { About, RegimeTest } from "../types";
import { Callout, Cited } from "./Cited";
import { FrameCanvas } from "./FrameStage";
import { FrameSizeTimeline } from "./FrameSizeTimeline";

const signed = (t: number) => `${t >= 0 ? "+" : "−"}${Math.abs(t).toFixed(1)} s`;

type Props = { test: RegimeTest | undefined; about: About | undefined };

/** Visualization 1: real frames of the hot ⇄ cool flame sequence of test 21291C1, with an exposure slider. */
export function CoolFlamePause({ test, about }: Props) {
  const [selected, setSelected] = useState(FRAMES[0].i);
  const [stops, setStops] = useState(0);
  const [mark, setMark] = useState(false);
  const sliderId = useId();
  const frame = FRAMES.find((f) => f.i === selected) ?? FRAMES[0];
  const gain = gainFromStops(stops);
  const quick = useMemo(() => [MIN_STOPS, 0, MAX_STOPS], []);
  const tiny = useMemo(() => ARCHIVE.filter((a) => a.t_s > 0 && a.compressed_bytes < 100_000), []);

  return (
    <section className="band cf-band" id="dark-pause" aria-labelledby="cf-v1-title">
      <p className="cf-kicker">Visualization 1 · ACME CFI-G, PSI-159</p>
      <h2 id="cf-v1-title" className="h-section">
        The dark pause and the cool flame
      </h2>
      <p className="lede">
        Real frames from one ISS test, {TEST_ID}: n-butane burning on a porous spherical burner, where the flame went
        back and forth between hot and cool. The exposure slider shows why a cool flame is easy to miss.
      </p>

      <dl className="cf-passport" aria-label="Imaging passport">
        <div>
          <dt>Test</dt>
          <dd>
            {TEST_ID} · {PASSPORT_STATIC.gravity}
            {test && (
              <>
                {" · "}
                {test.fuel === "butane" ? "n-butane" : test.fuel}, {test.flame_type} flame, {num(test.p_bar, 2, "bar")},
                XO₂ {pct(test.x_o2)}
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Camera</dt>
          <dd>{PASSPORT_STATIC.camera}</dd>
        </div>
        <div>
          <dt>Exposure</dt>
          <dd>
            {PASSPORT_STATIC.exposure} <span className="muted">({PASSPORT_STATIC.exposureSrc})</span>
          </dd>
        </div>
        <div>
          <dt>Dark frames</dt>
          <dd>{PASSPORT_STATIC.darkFrames}</dd>
        </div>
        <div>
          <dt>Scale of values</dt>
          <dd>{PASSPORT_STATIC.scale}</dd>
        </div>
        <div>
          <dt>Optical filter</dt>
          <dd>{PASSPORT_STATIC.filter}</dd>
        </div>
        <div>
          <dt>Length scale</dt>
          <dd>{PASSPORT_STATIC.barScale}</dd>
        </div>
        <div>
          <dt>Regime</dt>
          <dd>
            <Cited text={`${PASSPORT_STATIC.regime} [[kim2023]]`} />
          </dd>
        </div>
        <div>
          <dt>Diagnostics</dt>
          <dd>
            <Cited text={`${PASSPORT_STATIC.diagnostics} [[stocker2022]]`} />
          </dd>
        </div>
        <div>
          <dt>Credit</dt>
          <dd>
            NASA Physical Sciences Informatics, {about?.accession ?? "PSI-159"},{" "}
            <span className="cf-nowrap">{about?.license ?? "CC0-1.0"}</span>
            {about && (
              <>
                {" · "}
                <a href={about.doi_url} target="_blank" rel="noreferrer">
                  doi:{about.doi}
                </a>{" "}
                <CopyButton text={about.doi} label="Copy DOI" />
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="cf-v1">
        <figure className="cf-stage">
          <FrameCanvas
            url={frame.url}
            gain={gain}
            markSaturated={mark}
            label={`Frame ${frame.i} of test ${TEST_ID} at ${signed(frame.t_s)} from ignition, exposure ${gainLabel(stops)}. ${OBSERVATIONS[frame.i] ?? ""}`}
          />
          <figcaption className="mono small">
            <b>{signed(frame.t_s)}</b> · frame {String(frame.i).padStart(5, "0")} · {OBSERVATIONS[frame.i]}
          </figcaption>
        </figure>

        <div className="cf-side">
          <div className="cf-slider">
            <label htmlFor={sliderId} className="mono small">
              Exposure gain on the real data: <b>{gainLabel(stops)}</b>
            </label>
            <input
              id={sliderId}
              type="range"
              min={MIN_STOPS}
              max={MAX_STOPS}
              step={0.25}
              value={stops}
              onChange={(e) => setStops(Number(e.target.value))}
              aria-valuetext={`${gainLabel(stops)} exposure`}
            />
            <div className="cf-slider-ends mono small">
              <span>shorter: hot flame resolved</span>
              <span>longer: cool flame lifted</span>
            </div>
            <div className="cf-quick" role="group" aria-label="Exposure presets">
              {quick.map((s) => (
                <button key={s} type="button" className={`tag${stops === s ? " on" : ""}`} aria-pressed={stops === s} onClick={() => setStops(s)}>
                  {s === 0 ? "×1 NASA scale" : gainLabel(s)}
                </button>
              ))}
              <button type="button" className={`tag${mark ? " on" : ""}`} aria-pressed={mark} onClick={() => setMark((m) => !m)}>
                mark saturated
              </button>
            </div>
            <p className="small muted">
              The gain multiplies the measured counts, as a different exposure would. Pixels at full scale only say
              “at least this bright”: dimming them does not reveal detail, so mark them to see where that is.
            </p>
          </div>

          <dl className="cf-read">
            <dt>Time from ignition</dt>
            <dd>{signed(frame.t_s)} (±1 s)</dd>
            <dt>Camera clock (GMT)</dt>
            <dd>{frame.camera_time_gmt.replace("T", " ")}</dd>
            <dt>At full scale</dt>
            <dd>{num(frame.saturated_pct, 1, "%")} of sub-pixels</dd>
            <dt>Mean level</dt>
            <dd>{num(frame.mean_counts_of_4095, 0)} of 4095</dd>
            <dt>Frame size</dt>
            <dd>
              {WIDTH} × {HEIGHT} px (source {SOURCE_SIZE[0]} × {SOURCE_SIZE[1]})
            </dd>
          </dl>
        </div>
      </div>

      <div className="cf-film" role="group" aria-label="Frames of test 21291C1">
        {FRAMES.map((f) => (
          <button
            key={f.i}
            type="button"
            className={`cf-thumb${f.i === selected ? " on" : ""}`}
            aria-pressed={f.i === selected}
            aria-label={`Frame ${f.i}, ${signed(f.t_s)}`}
            onClick={() => setSelected(f.i)}
          >
            <FrameCanvas url={f.url} gain={1} markSaturated={false} label="" className="thumb" />
            <span className="mono small">{signed(f.t_s)}</span>
          </button>
        ))}
      </div>
      <p className="small muted cf-note">
        Frames are 5 s apart, so the pause of about one second in the papers cannot be resolved here; frame{" "}
        {FRAMES[FRAMES.length - 1].i} (almost dark) is a moment with no visible flame, not a measurement of the pause.
        Which frames are a hot flame and which a cool one is our reading of colour and brightness: the full-scale frames
        fit a hot flame flooding a long exposure, the teal ones a cool flame. The test sheet says only “
        {test?.comment ?? "5 transitions from hot to cool"}”. <span className="tag">derived</span>
      </p>

      <h3 className="cf-h3">The whole test, frame by frame</h3>
      <FrameSizeTimeline archive={ARCHIVE} shown={FRAMES} selected={selected} onSelect={setSelected} />
      <p className="small muted cf-note">
        Size of each frame in the PSI archive ({ARCHIVE_FILE}); no image was needed for this chart. A frame that is
        uniformly saturated compresses to about 13 KB, so after ignition {tiny.length} such frames stand out, at{" "}
        {tiny.map((a) => `${a.t_s > 0 ? "+" : ""}${a.t_s}`).join(", ")} s. Time zero is ignition, taken from the table at 1 s
        resolution ({T_ZERO}). <span className="tag">derived</span>
      </p>

      <h3 className="cf-h3">The three stages, from the papers</h3>
      <ol className="cells cf-stages">
        {STAGES.map((s) => (
          <li key={s.n} className="cell">
            <p className="mono small muted">{s.n}</p>
            <h4>{s.title}</h4>
            <p className="small">
              <Cited text={s.text} />
            </p>
          </li>
        ))}
      </ol>

      <div className="cf-callouts">
        {CALLOUTS_PAUSE.map((c) => (
          <Callout key={c.id} label={c.label} title={c.title}>
            {c.paragraphs.map((p) => (
              <p key={p} className="small">
                <Cited text={p} />
              </p>
            ))}
          </Callout>
        ))}
      </div>

      <figure className="cf-ref">
        <img src={REFERENCE.url} width={182} height={182} alt="NASA's representative image for study PSI-159: a bright flame above and a fainter teal flame below a porous burner on its stem" />
        <figcaption className="small">
          <b>NASA’s representative image for PSI-159</b>, as published in PSI. <span className="muted">{REFERENCE.psiFile}</span>
          <br />
          364 × 364 px, {REFERENCE.bytes.toLocaleString("en-US")} bytes, sha-256 {REFERENCE.sha256.slice(0, 12)}… · no scale bar and no
          caption beyond the file name. We show it unchanged.
        </figcaption>
      </figure>
      <Placeholder>
        a photo of the 6.35 mm porous spherical burner and the 60.87–65.65 s intensified formaldehyde-filtered sequence:
        neither is in the PSI-159 snapshot. The intensified camera stream (INTNS, 9 GB per test) has to be decoded from
        NASA’s .hobj format first.
      </Placeholder>
    </section>
  );
}
