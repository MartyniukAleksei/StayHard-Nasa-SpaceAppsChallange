import { useEffect, useRef, useState } from "react";
import { renderExposure } from "../lib/exposure";
import { HEIGHT, WIDTH } from "../frames";

// Decoded (sqrt-coded) pixels per frame URL. The stored 8-bit values are only meaningful through
// lib/exposure.ts, so frames are read back with getImageData, never shown through <img>.
const cache = new Map<string, Promise<Uint8ClampedArray>>();

function load(url: string): Promise<Uint8ClampedArray> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = WIDTH;
        c.height = HEIGHT;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return reject(new Error("canvas unavailable"));
        ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
        resolve(ctx.getImageData(0, 0, WIDTH, HEIGHT).data);
      };
      img.onerror = () => reject(new Error(`could not load ${url}`));
      img.src = url;
    });
    cache.set(url, p);
  }
  return p;
}

export function useFramePixels(url: string) {
  const [state, setState] = useState<{ url: string; data?: Uint8ClampedArray; error?: boolean }>({ url });
  useEffect(() => {
    let alive = true;
    load(url).then(
      (data) => alive && setState({ url, data }),
      () => alive && setState({ url, error: true }),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return state.url === url ? state : { url };
}

type Props = {
  url: string;
  gain: number;
  markSaturated: boolean;
  label: string;
  className?: string;
};

/** One frame painted with a linear exposure gain. */
export function FrameCanvas({ url, gain, markSaturated, label, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { data, error } = useFramePixels(url);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !data) return;
    const out = ctx.createImageData(WIDTH, HEIGHT);
    renderExposure(data, out.data, WIDTH, gain, markSaturated);
    ctx.putImageData(out, 0, 0);
  }, [data, gain, markSaturated]);

  return (
    <div className={`cf-canvas${className ? ` ${className}` : ""}`}>
      <canvas ref={ref} width={WIDTH} height={HEIGHT} role="img" aria-label={label} />
      {!data && !error && <p className="cf-canvas-msg mono small">Loading frame …</p>}
      {error && (
        <p className="cf-canvas-msg mono small" role="alert">
          Could not load this frame.
        </p>
      )}
    </div>
  );
}
