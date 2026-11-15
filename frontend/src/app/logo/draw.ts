// Animated StayHard header logo: the pixel fire from public/favicon.svg, swaying and flickering.
// shortcut: the mask is copied from favicon.svg's path; if the logo wins, generate one from the other.
const PATH =
  "M6 0h1M6 1h2M5 2h3M5 3h3M12 3h1M4 4h5M12 4h2M4 5h5M11 5h3M3 6h7M11 6h3M3 7h11M2 8h6M9 8h5M2 9h5M10 9h4M1 10h5M11 10h4M1 11h4M7 11h2M11 11h4M1 12h4M6 12h4M11 12h4M1 13h4M6 13h4M11 13h3M2 14h3M7 14h2M11 14h3M3 15h10";

export const N = 16;

/** Lit cells of the 16×16 logo, as [x, y]. */
export const CELLS: [number, number][] = [...PATH.matchAll(/M(\d+) (\d+)h(\d+)/g)].flatMap(([, x, y, w]) =>
  Array.from({ length: +w }, (_, i) => [+x + i, +y] as [number, number]),
);

// favicon gradient (pale yellow tip → orange → red base); the favicon is the one place with a gradient
const STOPS = [
  [0xff, 0xe0, 0x8a],
  [0xff, 0x9a, 0x3c],
  [0xe2, 0x41, 0x2b],
];

function color(y: number, a: number): string {
  const k = (y / (N - 1)) * 2;
  const i = Math.min(1, Math.floor(k));
  const f = k - i;
  const c = STOPS[i].map((v, j) => Math.round(v + (STOPS[i + 1][j] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Brightness 0..1 of a lit cell at time t (s): a flicker wave that rises through the flame; tips flicker hardest. */
export function brightness(x: number, y: number, t: number): number {
  const h = hash(x, y);
  const wave = 0.5 + 0.5 * Math.sin(t * 5 + y * 0.7 + h * 6.28);
  const tip = y < 5 ? 1 - y / 5 : 0; // the top tongues
  const b = 0.72 + 0.28 * wave - tip * 0.55 * (0.5 + 0.5 * Math.sin(t * 9 + h * 20));
  return Math.max(0, Math.min(1, b));
}

/** Cell offset (in cells) at time t: the flame sways and trembles; the base stays put, the tips move most. */
export function offset(x: number, y: number, t: number): [number, number] {
  const up = 1 - y / (N - 1); // 1 at the tip, 0 at the base
  const sway = up ** 1.5 * 0.6 * Math.sin(t * 3.1 + y * 0.45);
  const shake = (hash(x + Math.floor(t * 11), y) - 0.5) * 0.3 * up; // new jitter every frame
  const lick = -up * 0.35 * (0.5 + 0.5 * Math.sin(t * 7 + x * 0.9));
  return [sway + shake, lick];
}

export function drawLogo(cv: HTMLCanvasElement, t: number): void {
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
  // one spare cell for the movement: half on each side, the rest on top; cells stretch with the canvas
  const cw = W / (N + 1);
  const ch = H / (N + 1);
  const ox = cw / 2;
  const oy = ch;
  for (const [x, y] of CELLS) {
    const v = brightness(x, y, t);
    const [dx, dy] = offset(x, y, t);
    const px = ox + (x + dx) * cw;
    const py = oy + (y + dy) * ch;
    g.fillStyle = color(y, 0.25 + 0.75 * v);
    g.fillRect(px, py, cw, ch);
  }
}
