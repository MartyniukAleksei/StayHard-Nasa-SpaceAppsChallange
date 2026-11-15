// Deterministic "beeswarm" placement for the explorer map: tests with the same O₂ in the same
// row (diluent × pressure) would sit on one pixel. Each point keeps its x when it can and moves
// up/down into a free lane inside its row band; when the band is full it steps sideways a little
// (right, left, further right …), staying inside the plot.

export type DotIn = { id: number; x: number; y: number };
export type DotOut = { id: number; x: number; y: number };

type Opts = {
  /** glyph radius, px */
  r: number;
  /** min free space between glyphs, px */
  gap: number;
  /** half height of the row band available to the dots, px */
  half: number;
  /** how many horizontal steps to try before giving up (then the dot may overlap) */
  maxSteps?: number;
  /** plot bounds for x, px */
  xMin?: number;
  xMax?: number;
};

/** Lane offsets 0, +d, −d, +2d, −2d … that still fit inside ±limit. */
function lanes(d: number, limit: number): number[] {
  const out = [0];
  for (let k = 1; k * d <= limit + 1e-9; k++) out.push(k * d, -k * d);
  return out;
}

/** Step offsets 0, +1, −1, +2, −2 … in units of half a glyph spacing. */
const sideSteps = (n: number) => Array.from({ length: 2 * n + 1 }, (_, i) => (i % 2 ? (i + 1) / 2 : -i / 2));

export function layoutDots(
  dots: DotIn[],
  { r, gap, half, maxSteps = 400, xMin = -Infinity, xMax = Infinity }: Opts,
): DotOut[] {
  const d = 2 * r + gap;
  const offsets = lanes(d, Math.max(0, half - r));
  const byRow = new Map<number, DotIn[]>();
  for (const p of dots) {
    const row = byRow.get(p.y) ?? [];
    row.push(p);
    byRow.set(p.y, row);
  }
  const out: DotOut[] = [];
  for (const [y, row] of byRow) {
    const placed: DotOut[] = [];
    const free = (x: number, yy: number) =>
      placed.every((q) => (q.x - x) ** 2 + (q.y - yy) ** 2 >= d * d - 1e-6);
    for (const p of [...row].sort((a, b) => a.x - b.x || a.id - b.id)) {
      let spot: DotOut | null = null;
      for (const step of sideSteps(maxSteps)) {
        const x = p.x + (step * d) / 2;
        if (x < xMin + r || x > xMax - r) continue;
        const off = offsets.find((o) => free(x, y + o));
        if (off !== undefined) {
          spot = { id: p.id, x, y: y + off };
          break;
        }
      }
      const final = spot ?? { id: p.id, x: p.x, y };
      placed.push(final);
      out.push(final);
    }
  }
  return out;
}
