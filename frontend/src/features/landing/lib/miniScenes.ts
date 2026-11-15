/** Brightness at normalized (x, y) (y down, |y| ≤ 0.5) and time t; `flame` paints it blue. */
export type Pixel = { v: number; flame: boolean };
export type Scene = (x: number, y: number, t: number) => Pixel;

const CYCLE_S = 6; // each scene burns down and starts again
const OFF: Pixel = { v: 0, flame: false };
const phase = (t: number) => (t % CYCLE_S) / CYCLE_S;
const band = (d: number, w: number) => Math.exp(-((d / w) ** 2));

/** FLEX: a droplet burning inside a spherical flame. */
const droplet: Scene = (x, y, t) => {
  const u = phase(t);
  const rd = 0.09 * Math.sqrt(Math.max(0.05, 1 - u)); // d² falls linearly in time
  const rf = u < 0.85 ? 0.3 + 0.06 * Math.sin(u * Math.PI) : 0; // flame out near the end
  const r = Math.hypot(x, y);
  if (r < rd) return { v: 0.75 + 0.25 * (1 - r / rd), flame: false };
  if (rf > 0) {
    const rr = rf * (1 + 0.03 * Math.sin(Math.atan2(y, x) * 5 + t * 3));
    return { v: band(r - rr, 0.035), flame: true };
  }
  return OFF;
};

/** BASS-II: a flame front travelling along a solid rod, leaving char behind. */
const rod: Scene = (x, y, t) => {
  const u = phase(t);
  const xf = -0.7 + 1.4 * u;
  if (u < 0.9) {
    const dx = (x - xf - 0.04) / 0.2;
    const dy = y / (0.11 * (1 + 0.08 * Math.sin(t * 9 + x * 20)));
    const ring = band(Math.hypot(dx, dy) - 1, 0.25);
    if (ring > 0.15 && Math.abs(y) > 0.03) return { v: ring, flame: true };
  }
  if (Math.abs(y) > 0.035 || Math.abs(x) > 0.7) return OFF;
  return { v: x > xf ? 0.7 : 0.25, flame: false };
};

/** SAFFIRE-II: a flame front climbing a large fabric sheet; burnt fabric is gone. */
const sheet: Scene = (x, y, t) => {
  const u = phase(t);
  if (Math.abs(x) > 0.38 || Math.abs(y) > 0.46) return OFF;
  const yf = 0.46 - 1.0 * u + 0.03 * Math.sin(x * 14 + t * 4);
  const front = u < 0.92 ? band(y - yf, 0.04) : 0;
  if (front > 0.2) return { v: front, flame: true };
  return y < yf ? { v: (Math.round(x * 40 + y * 30) & 1) ? 0.35 : 0.2, flame: false } : OFF;
};

/** SAME-R: smoke drifting from a heated source into a detector that then triggers. */
const smoke: Scene = (x, y, t) => {
  const u = phase(t);
  const inBox = x > 0.52 && x < 0.74 && Math.abs(y) < 0.18;
  const edge = inBox && (x < 0.56 || x > 0.7 || Math.abs(y) > 0.1);
  if (edge) return { v: 0.8, flame: u > 0.8 };
  if (Math.hypot(x + 0.68, y) < 0.04) return { v: 0.9, flame: false };
  const front = -0.68 + 1.5 * u;
  if (x < -0.64 || x > Math.min(front, 0.52)) return OFF;
  const c = 0.06 * Math.sin(x * 7 - t * 2);
  const w = 0.03 + 0.12 * (x + 0.68);
  const puffs = 0.5 + 0.5 * Math.sin(x * 22 - t * 5 + y * 9);
  return { v: band(y - c, w) * puffs * 0.8, flame: false };
};

/** Mini scene and caption for a study card, by acronym; null when we have none. */
export const MINI: Record<string, { scene: Scene; caption: string }> = {
  FLEX: { scene: droplet, caption: "a fuel droplet burning inside a spherical flame" },
  "BASS-II": { scene: rod, caption: "a flame spreading along a solid fuel sample" },
  "SAFFIRE-II": { scene: sheet, caption: "a flame front climbing a large fabric sample" },
  "SAME-R": { scene: smoke, caption: "smoke particles drifting into a detector" },
};
