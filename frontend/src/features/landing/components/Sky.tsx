import { useEffect, useRef, type RefObject } from "react";
import { drawCosmos, drawSky, readSkyPalette } from "../lib/sky";

const FRAME_MS = 90; // ≈11 frames/s (DS)
const MAX_STEP_S = 0.2; // do not jump after a long pause
const START_T = 30;

/**
 * Animates the landing sky (section canvas) and the comets (fixed viewport canvas).
 * Pauses the sky off screen; with prefers-reduced-motion draws a single still frame.
 */
export function useSky(
  sky: RefObject<HTMLCanvasElement | null>,
  cosmos: RefObject<HTMLCanvasElement | null>,
  text: RefObject<HTMLElement | null>,
) {
  const t = useRef(START_T);

  useEffect(() => {
    const skyC = sky.current;
    const cosC = cosmos.current;
    const txt = text.current;
    if (!skyC || !cosC || !txt) return;

    const pal = readSkyPalette(skyC);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    let last = 0;
    let raf = 0;

    const draw = () => {
      if (visible) drawSky(skyC, txt, t.current, pal);
      drawCosmos(cosC, t.current, pal);
    };
    const loop = (ts: number) => {
      if (ts - last > FRAME_MS) {
        if (last) t.current += Math.min(MAX_STEP_S, (ts - last) / 1000);
        last = ts;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(skyC);
    const ro = new ResizeObserver(() => drawSky(skyC, txt, t.current, pal));
    ro.observe(skyC);
    const onResize = () => drawCosmos(cosC, t.current, pal);
    window.addEventListener("resize", onResize);
    let alive = true;
    document.fonts?.ready.then(() => alive && draw());

    if (reduced) draw();
    else raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [sky, cosmos, text]);
}
