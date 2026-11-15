// ASCII light-field renderer ported from docs/design/stayhard-ds.html (lum/render).
// Scene = brightness 0..1 in normalized coordinates (centre 0,0; frame height = 1).

const RAMP = " .:-=+*#%@";

export type Scene = {
  /** droplet radius, normalized */
  rd: number;
  /** flame radius, normalized; 0 = no flame */
  rf: number;
};

const hash = (i: number, j: number) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Flame shell brightness: thin flickering sphere around the droplet. */
function shell(x: number, y: number, s: Scene, phase: number): number {
  if (s.rf <= 0) return 0;
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  const width = Math.max(0.02, s.rf * 0.16);
  const rf = s.rf * (1 + 0.03 * Math.sin(a * 5 + phase * 1.7) + 0.02 * Math.sin(a * 11 - phase * 2.3));
  const ring = Math.exp(-(((r - rf) / width) ** 2));
  const glow = 0.22 * Math.exp(-((r / (s.rf * 1.5)) ** 2));
  return Math.min(1, ring + glow);
}

/** Droplet brightness: solid core that fades at the edge. */
function droplet(x: number, y: number, s: Scene): number {
  const r = Math.hypot(x, y);
  const rd = Math.max(s.rd, 0.012);
  return r < rd ? 0.65 + 0.35 * (1 - r / rd) : 0;
}

export type Palette = { bg: string; ink: string; flame: string; font: string };

export function renderAscii(
  cv: HTMLCanvasElement,
  scene: Scene,
  phase: number,
  pal: Palette,
  cell = 9,
): void {
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
  g.fillStyle = pal.bg;
  g.fillRect(0, 0, W, H);
  g.font = `${cell + 2}px ${pal.font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";

  const S = H;
  const ox = W / 2;
  const oy = H / 2;
  const cols = Math.ceil(W / cell);
  const rows = Math.ceil(H / cell);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const px = (i + 0.5) * cell;
      const py = (j + 0.5) * cell;
      const x = (px - ox) / S;
      const y = (py - oy) / S;
      const d = droplet(x, y, scene);
      const f = shell(x, y, scene, phase);
      const v = Math.max(d, f) - hash(i, j) * 0.06;
      const k = Math.round(Math.max(0, Math.min(1, v)) * (RAMP.length - 1));
      if (k === 0) continue;
      g.fillStyle = f > d ? pal.flame : pal.ink;
      g.fillText(RAMP[k], px, py);
    }
  }
}
