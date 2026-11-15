import { useEffect, useRef } from "react";
import type { Scene } from "../lib/miniScenes";

const RAMP = " .:-=+*#%@";
const CELL = 7;
const FRAME_MS = 90; // ~11 frames/s (DS)

/** Tiny ASCII picture of what a study is about (scene from lib/miniScenes). */
export function FlameMini({ scene, caption }: { scene: Scene; caption: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const cs = getComputedStyle(cv);
    const ink = cs.getPropertyValue("--ink").trim();
    const flame = cs.getPropertyValue("--flame").trim();
    const font = cs.getPropertyValue("--mono").trim();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    let visible = true;

    const draw = (t: number) => {
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(W * dpr);
      const bh = Math.round(H * dpr);
      if (cv.width !== bw || cv.height !== bh) {
        cv.width = bw;
        cv.height = bh;
      }
      const g = cv.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.font = `${CELL + 2}px ${font}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (let py = CELL / 2; py < H; py += CELL * 1.25) {
        for (let px = CELL / 2; px < W; px += CELL * 0.8) {
          const { v, flame: f } = scene((px - W / 2) / H, (py - H / 2) / H, t);
          const k = Math.round(Math.min(1, v) * (RAMP.length - 1));
          if (k === 0) continue;
          g.fillStyle = f ? flame : ink;
          g.fillText(RAMP[k], px, py);
        }
      }
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(cv);
    const loop = (ts: number) => {
      if (visible && ts - last > FRAME_MS) {
        last = ts;
        draw(ts / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    if (reduced) draw(1.5);
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [scene]);

  return (
    <figure className="land-mini">
      <canvas ref={canvas} role="img" aria-label={caption} />
      <figcaption className="mono">{caption}</figcaption>
    </figure>
  );
}
