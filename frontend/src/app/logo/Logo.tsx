import { useEffect, useRef } from "react";
import { drawLogo } from "./draw";

const FRAME_MS = 90; // DS: textures animate at ~11 frames/s

/** Animated pixel-fire logo for the header; one still frame with prefers-reduced-motion. */
export function Logo({ size = 24 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      drawLogo(cv, 0);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      if (ts - last > FRAME_MS) {
        last = ts;
        drawLogo(cv, (ts - t0) / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="brand-icon" style={{ width: size, height: size }} aria-hidden="true" />;
}
