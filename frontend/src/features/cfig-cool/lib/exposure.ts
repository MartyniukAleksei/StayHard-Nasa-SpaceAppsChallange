// Exposure gain on real camera data. The frames in assets/ are stored sqrt-coded
// (jpeg = round(255 * sqrt(counts / full_scale)), docs/data/cfig-cool-flame-frames/README.md),
// so decoding gives linear counts again and the slider multiplies those, as a longer or shorter
// exposure would. It cannot recover detail in saturated pixels: they only say "at least this much".

/** Frames are shown 8-bit linear (as the NASA converter scaled them: 0..4095 counts). */
export const FULL_SCALE_COUNTS = 4095;
/** A sub-pixel at or above this stored value is (nearly) saturated: >= 96% of full scale. */
export const SATURATED_V8 = 250;
export const MIN_STOPS = -6;
export const MAX_STOPS = 4;

const DECODE = new Float32Array(256).map((_, v) => (v / 255) ** 2);

/** Stored 8-bit value -> linear fraction of full scale (0..1). */
export const decodeSqrt = (v8: number): number => DECODE[Math.max(0, Math.min(255, Math.round(v8)))];

/** Linear fraction of full scale -> stored 8-bit value (the inverse; used by tests and the script). */
export const encodeSqrt = (lin: number): number => Math.round(255 * Math.sqrt(Math.max(0, Math.min(1, lin))));

export const gainFromStops = (stops: number): number => 2 ** stops;

/** "×1", "×4", "×1/16": how the slider reads. */
export function gainLabel(stops: number): string {
  if (stops >= 0) return `×${Math.round(2 ** stops * 100) / 100}`;
  return `×1/${Math.round(2 ** -stops * 100) / 100}`;
}

/**
 * Paints `src` (RGBA, sqrt-coded) into `dst` (RGBA) with a linear gain.
 * With `markSaturated`, saturated pixels get a hatch so a dimmed hot flame is not mistaken for a dim flame.
 */
export function renderExposure(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  gain: number,
  markSaturated: boolean,
): void {
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    const sat = src[i] >= SATURATED_V8 || src[i + 1] >= SATURATED_V8 || src[i + 2] >= SATURATED_V8;
    if (markSaturated && sat && ((p % width) + Math.floor(p / width)) % 6 < 3) {
      dst[i] = 217; dst[i + 1] = 164; dst[i + 2] = 65; // --warn hatch
    } else {
      dst[i] = Math.min(255, DECODE[src[i]] * gain * 255);
      dst[i + 1] = Math.min(255, DECODE[src[i + 1]] * gain * 255);
      dst[i + 2] = Math.min(255, DECODE[src[i + 2]] * gain * 255);
    }
    dst[i + 3] = 255;
  }
}
