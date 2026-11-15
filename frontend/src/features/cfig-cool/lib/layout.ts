// Greedy dot layout: dots that would overlap are nudged apart, trying the free axis first (vertical
// inside a pressure lane), so a dot keeps its true value on the axis that carries one.
export interface DotIn {
  id: string;
  x: number;
  y: number;
}
export interface DotOut extends DotIn {
  /** true when the dot was moved away from its true position to avoid overlap */
  nudged: boolean;
}

interface Options {
  /** dot radius (the widest glyph) and the gap kept between dots, in px */
  r: number;
  gap: number;
  /** how far a dot may move vertically (a lane's half height) and horizontally, px */
  maxDy: number;
  maxDx: number;
}

/** Places dots so none touch (when there is room). Input order decides who keeps the true spot. */
export function layoutDots(dots: DotIn[], { r, gap, maxDy, maxDx }: Options): DotOut[] {
  const min2 = (2 * r + gap) ** 2;
  const step = 2 * r + gap;
  const placed: DotOut[] = [];
  const grid = new Map<string, DotOut[]>();
  const cell = step;
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  const free = (x: number, y: number) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cy - 1; j <= cy + 1; j++) {
        for (const o of grid.get(key(i, j)) ?? []) {
          if ((o.x - x) ** 2 + (o.y - y) ** 2 < min2) return false;
        }
      }
    }
    return true;
  };
  const put = (d: DotIn, x: number, y: number) => {
    const out: DotOut = { id: d.id, x, y, nudged: x !== d.x || y !== d.y };
    placed.push(out);
    const k = key(Math.floor(x / cell), Math.floor(y / cell));
    grid.set(k, [...(grid.get(k) ?? []), out]);
  };
  const dys = [0];
  for (let k = 1; k * step <= maxDy; k++) dys.push(k * step, -k * step);
  const dxs = [0];
  for (let k = 1; k * step <= maxDx; k++) dxs.push(k * step, -k * step);

  for (const d of dots) {
    let spot: [number, number] | null = null;
    outer: for (const dx of dxs) {
      for (const dy of dys) {
        if (free(d.x + dx, d.y + dy)) {
          spot = [d.x + dx, d.y + dy];
          break outer;
        }
      }
    }
    put(d, ...(spot ?? [d.x, d.y])); // no room left: leave it overlapping rather than hide it
  }
  return placed;
}
