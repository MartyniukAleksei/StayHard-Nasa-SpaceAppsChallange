// One chart theme for every SVG chart (TimeChart, the explorer map, the 3D timeline).
// Colours live in tokens.css (--ink, --ash, --flame, --end-*, --series-*, --chart-*);
// sizes and shapes live here. docs/design/README.md → "Charts" shows how to use them.
import type { EndType } from "@/shared/ui/EndMark";

/** Plot margins: left fits 4-digit ticks, bottom fits ticks + axis label. */
export const MARGIN = { l: 48, r: 16, t: 18, b: 36 } as const;

/** Raster dot of a measured series (DS: measurements are dots, models are lines). */
export const DOT = 2;

/** Radius of an end-type glyph on a scatter. */
export const GLYPH_R = 4;

export type Tone = "ink" | "ash" | "flame" | "ext" | "dis" | "com" | "s1" | "s2" | "uv";

/** Same glyphs as EndMark: ● Extinction, ○ Completion, ◇ Disruption. Colour never stands alone. */
export const END_SHAPE: Record<EndType, "dot" | "ring" | "diamond"> = {
  Extinction: "dot",
  Completion: "ring",
  Disruption: "diamond",
};

export const END_TONE: Record<EndType, Tone> = {
  Extinction: "ext",
  Completion: "com",
  Disruption: "dis",
};
