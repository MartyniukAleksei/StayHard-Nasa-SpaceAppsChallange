import { useEffect, useMemo, useRef, useState } from "react";
import { useReplay } from "../api";
import { renderAscii, type Palette } from "../lib/ascii";
import { duration, frameAt, maxDiameter } from "../lib/frame";
import type { Replay } from "../types";
import "./replay.css";

const FPS = 11; // DS: textures animate at ~11 frames/s
const FILL = 0.85; // largest measured diameter covers 85% of frame height
const START_T = 4;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { bg: v("--void"), ink: v("--ink"), flame: v("--flame"), font: v("--mono") };
}

function fmt(v: number | null, unit: string): string {
  return v == null ? "—" : `${v.toFixed(2)} ${unit}`;
}

export function DropletReplay({ testNo }: { testNo: number }) {
  const { data, isPending, isError } = useReplay(testNo);
  if (isPending) return <div className="replay replay-empty">Loading measured series…</div>;
  if (isError || !data) return <div className="replay replay-empty">Replay unavailable.</div>;
  if (data.droplet.length === 0) {
    return <div className="replay replay-empty">No droplet series for test #{testNo}.</div>;
  }
  return <ReplayView replay={data} />;
}

function ReplayView({ replay }: { replay: Replay }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useMemo(prefersReducedMotion, []);
  const tMax = useMemo(() => duration(replay), [replay]);
  const scale = useMemo(() => FILL / maxDiameter(replay), [replay]);
  const [t, setT] = useState(() => Math.min(START_T, tMax));
  const [playing, setPlaying] = useState(!reduced);
  const [visible, setVisible] = useState(true);
  const frame = frameAt(replay, t);

  // pause when offscreen
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // advance time while playing
  useEffect(() => {
    if (!playing || !visible) return;
    const id = window.setInterval(() => {
      setT((prev) => (prev + 1 / FPS > tMax ? 0 : prev + 1 / FPS));
    }, 1000 / FPS);
    return () => window.clearInterval(id);
  }, [playing, visible, tMax]);

  // draw
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const draw = () =>
      renderAscii(
        cv,
        {
          rd: ((frame.dropletMm ?? 0) / 2) * scale,
          rf: ((frame.flameMm ?? 0) / 2) * scale,
        },
        reduced ? 0 : frame.t * 3,
        readPalette(cv),
      );
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [frame.dropletMm, frame.flameMm, frame.t, scale, reduced]);

  const flameText = frame.flameMm == null ? "flame out" : `flame ${fmt(frame.flameMm, "mm")}`;

  return (
    <figure className="replay">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Test ${replay.test_no}: droplet and flame drawn from measured diameters`}
      />
      <div className="replay-controls">
        <button
          type="button"
          className="btn ghost"
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={playing}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={tMax.toFixed(1)}
          step={0.1}
          value={t}
          onChange={(e) => {
            setPlaying(false);
            setT(Number(e.target.value));
          }}
          aria-label={`Time in test ${replay.test_no}, seconds`}
        />
      </div>
      <figcaption className="replay-readout mono">
        <span>t = {t.toFixed(1)} s</span>
        <span>droplet {fmt(frame.dropletMm, "mm")}</span>
        <span className={frame.flameMm == null ? "muted" : undefined}>{flameText}</span>
      </figcaption>
      <p className="replay-note">
        Animation from measured diameters · test #{replay.test_no} · no video in this dataset
      </p>
    </figure>
  );
}
