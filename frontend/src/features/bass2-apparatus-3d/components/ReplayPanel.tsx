import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { usePlayback } from "@/shared/three/playback";
import { apiHref, type ReplayReport } from "../api";
import { FLAME_VISIBLE_PX, REPLAY_SPEEDS, REPLAY_TESTS, type ReplayTest } from "../content";
import { sample } from "../lib/replay";
import { useSim, type Sim } from "../lib/sim";
import type { Layers } from "./Scene";
import { LayerToggles } from "./Controls";

const H = 110;
const PAD = { l: 8, r: 8, t: 14, b: 20 };
/** The video follows the clock only up to this speed; faster, it pauses and is nudged along. */
const VIDEO_MAX_RATE = 4;

export function TestPicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="b3d-tags" role="group" aria-label="Test to replay">
      <span className="b3d-label">test</span>
      {REPLAY_TESTS.map((t) => (
        <button key={t.id} type="button" className={`tag ${t.id === selected ? "on" : ""}`} aria-pressed={t.id === selected} onClick={() => onSelect(t.id)}>
          {t.id}
        </button>
      ))}
    </div>
  );
}

interface PanelProps {
  sim: Sim;
  test: ReplayTest;
  report: ReplayReport | undefined;
  status: "pending" | "error" | "success";
  layers: Layers;
  onLayers: (l: Layers) => void;
}

/** Right-hand column in replay mode: the test, its timeline, the readouts and the NASA video on request. */
export function ReplayPanel({ sim, test, report, status, layers, onLayers }: PanelProps) {
  const { replay } = useSim(sim);
  const row = report?.test;
  return (
    <div className="b3d-controls b3d-replay">
      <div className="b3d-head">
        <h3 className="b3d-title">
          <Link to={`/studies/bass2/tests/${encodeURIComponent(test.id)}`}>{test.id}</Link> · {test.title}
        </h3>
        {row && (
          <p className="b3d-sub">
            {row.material}
            {row.thickness_mm != null ? ` · ${row.thickness_mm} mm thick` : ""}
            {row.diameter_mm != null ? ` · ${row.diameter_mm} mm diameter` : ""} · {row.flow_config ?? "flow n/a"} flow ·{" "}
            {row.o2_initial_pct != null ? `${row.o2_initial_pct} % O₂ at ignition` : "O₂ n/a"} · {row.outcome ?? "outcome n/a"}{" "}
            <span className="mono">(tests table)</span>
          </p>
        )}
        <p className="b3d-sub">
          Researchers' log: “{test.log.text}” <span className="mono">(Appendix A, p.{test.log.page})</span>
        </p>
      </div>
      {status === "pending" && <p className="b3d-caption mono">Loading the test report…</p>}
      {status === "error" && <p className="b3d-caption">The test report did not load, so there is nothing to replay.</p>}
      {status === "success" && !report?.video_series && (
        <p className="b3d-caption">No timeline was read from this test's video, so the scene cannot replay it.</p>
      )}
      {replay && replay.test.id === test.id && (
        <>
          <Timeline sim={sim} />
          <Readouts sim={sim} />
          <div className="b3d-actions">
            <LayerToggles layers={layers} onLayers={onLayers} />
          </div>
          {report && <VideoFollower sim={sim} report={report} />}
        </>
      )}
    </div>
  );
}

/** Air display and flame visibility against video time; click or drag to seek. */
function Timeline({ sim }: { sim: Sim }) {
  const r = sim.replay!;
  const { t, playing, speed } = usePlayback(r.playback);
  const svg = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = svg.current!;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const m = r.model;
  const x = (s: number) => PAD.l + ((s - m.tMin) / (m.tMax - m.tMin)) * (W - PAD.l - PAD.r);
  const y0 = PAD.t;
  const y1 = H - PAD.b;
  let airMax = 1;
  for (const v of m.air.v) airMax = Math.max(airMax, v);
  const yAir = (v: number) => y1 - (v / airMax) * (y1 - y0);
  const logMax = Math.log10(m.sceneMax + 1);
  const yScene = (v: number) => y1 - (Math.log10(v + 1) / logMax) * (y1 - y0);
  const airPath = Array.from(m.air.t, (s, i) => `${i ? "L" : "M"}${x(s).toFixed(1)},${yAir(m.air.v[i]).toFixed(1)}`).join(" ");
  const scenePath = Array.from(m.scene.t, (s, i) => `${i ? "L" : "M"}${x(s).toFixed(1)},${yScene(m.scene.v[i]).toFixed(1)}`).join(" ");

  const seekFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - box.left - PAD.l) / (box.width - PAD.l - PAD.r);
    r.playback.seek(m.tMin + Math.min(1, Math.max(0, f)) * (m.tMax - m.tMin));
  };

  return (
    <div className="b3d-timeline">
      <div className="b3d-tl-controls">
        <button type="button" className="btn" onClick={() => r.playback.toggle()}>
          {playing ? "Pause" : "Play"}
        </button>
        <div className="b3d-tags" role="group" aria-label="Playback speed">
          {REPLAY_SPEEDS.map((s) => (
            <button key={s} type="button" className={`tag ${s === speed ? "on" : ""}`} aria-pressed={s === speed} onClick={() => r.playback.setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>
      <svg
        ref={svg}
        height={H}
        role="slider"
        tabIndex={0}
        aria-label="Position in the test's video"
        aria-valuemin={Math.round(m.tMin)}
        aria-valuemax={Math.round(m.tMax)}
        aria-valuenow={Math.round(t)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromEvent(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && seekFromEvent(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") r.playback.seek(t + 10);
          if (e.key === "ArrowLeft") r.playback.seek(t - 10);
          if (e.key === " ") {
            e.preventDefault();
            r.playback.toggle();
          }
        }}
      >
        <line className="tick" x1={PAD.l} x2={W - PAD.r} y1={y1} y2={y1} />
        <path className="scene" d={scenePath} />
        <path className="air" d={airPath} />
        {m.flameOnAt != null && <Marker x={x(m.flameOnAt)} y0={y0} y1={y1} row={0} label="flame appears" kind="ash" />}
        {m.zeroFlowAt != null && <Marker x={x(m.zeroFlowAt)} y0={y0} y1={y1} row={1} label="air reads 0" kind="ash" />}
        {m.flameOutAt != null && <Marker x={x(m.flameOutAt)} y0={y0} y1={y1} row={2} label="flame fades" kind="flame" />}
        <text x={PAD.l} y={H - 6}>
          {Math.round(m.tMin)} s
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end">
          {Math.round(m.tMax)} s of video
        </text>
        <line className="cursor" x1={x(t)} x2={x(t)} y1={4} y2={y1 + 2} />
      </svg>
      <p className="b3d-legend mono">
        <span className="k-air">— air display, cm/s (max {Math.round(airMax)})</span>
        <span className="k-scene">— bright pixels, log scale (flame visibility)</span>
        <span className="tag">estimate</span>
      </p>
    </div>
  );
}

/** Labels sit on three rows so close events stay readable. */
function Marker({ x, y0, y1, row, label, kind }: { x: number; y0: number; y1: number; row: number; label: string; kind: "ash" | "flame" }) {
  return (
    <g className={`mark ${kind}`}>
      <line x1={x} x2={x} y1={y0 - 4} y2={y1} />
      <text x={x + 3} y={y0 + 4 + row * 12}>
        {label}
      </text>
    </g>
  );
}

/** Numbers at the clock's time. Every value is the overlay reading, an estimate. */
function Readouts({ sim }: { sim: Sim }) {
  const r = sim.replay!;
  const { t } = usePlayback(r.playback);
  const m = r.model;
  const air = sample(m.air, t);
  const fan = sample(m.fan, t);
  const rad = sample(m.rad, t);
  const px = sample(m.scene, t);
  const fmt = (v: number | null, d = 0, unit = "") => (v == null ? "unreadable" : `${v.toFixed(d)}${unit}`);
  return (
    <dl className="b3d-readouts mono">
      <dt>video time</dt>
      <dd>{t.toFixed(0)} s</dd>
      <dt>air display</dt>
      <dd>{fmt(air, 0, " cm/s")}</dd>
      <dt>fan display</dt>
      <dd>{fmt(fan, 0, " ×10 V")}</dd>
      <dt>radiometer</dt>
      <dd>{fmt(rad, 1, " rel.")}</dd>
      <dt>bright pixels</dt>
      <dd>
        {fmt(px)} {px != null && (px >= FLAME_VISIBLE_PX ? <span className="b3d-live">· flame visible</span> : "· no flame")}
      </dd>
    </dl>
  );
}

/** The NASA video next to the scene, on request: it follows the clock (large file, streams from PSI). */
function VideoFollower({ sim, report }: { sim: Sim; report: ReplayReport }) {
  const r = sim.replay!;
  const [show, setShow] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const lastSeek = useRef(0);
  const idx = report.video_series?.psi_video_index;
  const clip = idx == null ? undefined : report.psi_videos.find((v) => v.index === idx);

  useEffect(() => {
    if (!show) return;
    const follow = () => {
      const el = video.current;
      if (!el) return;
      const p = r.playback;
      const drift = Math.abs(el.currentTime - p.t);
      const now = performance.now();
      if (p.playing && p.speed <= VIDEO_MAX_RATE && p.active) {
        el.playbackRate = p.speed;
        if (drift > 1.5 && now - lastSeek.current > 800) {
          el.currentTime = p.t;
          lastSeek.current = now;
        }
        if (el.paused) el.play().catch(() => undefined);
      } else {
        if (!el.paused) el.pause();
        if (drift > 1 && now - lastSeek.current > 1000) {
          el.currentTime = p.t;
          lastSeek.current = now;
        }
      }
    };
    follow();
    const unsubscribe = r.playback.subscribe(follow);
    return () => {
      unsubscribe();
    };
  }, [show, r]);

  if (!clip) return null;
  return (
    <div className="b3d-video">
      <label className="b3d-layer">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        NASA video next to the scene ({Math.round(clip.bytes / 1e6)} MB, streams from PSI)
      </label>
      {show && (
        <figure>
          <video ref={video} src={apiHref(clip.url)} preload="metadata" muted playsInline />
          <figcaption className="b3d-caption mono">
            The recording the series was read from; it follows the clock up to {VIDEO_MAX_RATE}×, faster it steps along. Overlay: N₂ flow, air speed, fan
            voltage ×10, radiometer, GMT.
          </figcaption>
        </figure>
      )}
    </div>
  );
}
