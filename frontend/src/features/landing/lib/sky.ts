// ASCII sky for the landing (port of docs/design/flex-landing.html): the Moon, an orbiting
// satellite, and comets. Pure drawing functions: the caller owns the animation loop.

const RAMP = " .:-=+*#%@";
const ORBIT_S = 26; // seconds per satellite orbit
const WIDE_PX = 860;

export type SkyPalette = { ink: string; flame: string; bg: string; font: string };

export function readSkyPalette(el: Element): SkyPalette {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { ink: v("--ink"), flame: v("--flame"), bg: v("--void"), font: v("--mono") };
}

const hash = (i: number, j: number) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Satellite brightness and beacon at a point in its local frame. */
function satBody(x0: number, y0: number, t: number): [number, number] {
  let v = 0;
  const x = x0 * 0.72;
  const y = y0 * 0.72;
  const a = 0.08 * Math.sin(t * 0.4);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dy = y + 0.06 - 0.01 * Math.sin(t * 0.9);
  const u = c * x + s * dy;
  const w = -s * x + c * dy;
  const au = Math.abs(u);
  if (au < 0.07 && Math.abs(w) < 0.1) {
    v = Math.max(v, 0.62 + (0.38 * (u + 0.07)) / 0.14 - (Math.abs(w) > 0.085 ? 0.3 : 0));
  }
  const fold = 0.25 + 0.75 * Math.abs(Math.cos(t * 0.55));
  const ph = 0.08 * fold;
  if (au > 0.12 && au < 0.5 && Math.abs(w) < ph) {
    const gu = ((au - 0.12) / 0.076) % 1;
    let p = gu < 0.12 ? 0.25 : 0.5 + 0.35 * fold;
    p += 0.35 * fold * Math.exp(-(((au - (0.31 + 0.17 * Math.sin(t * 0.55))) / 0.045) ** 2));
    v = Math.max(v, Math.min(1, p));
  }
  if (au >= 0.07 && au <= 0.12 && Math.abs(w) < 0.014) v = Math.max(v, 0.5);
  const dr = Math.hypot(u, w + 0.17);
  if (dr > 0.04 && dr < 0.058 && w < -0.15) v = Math.max(v, 0.75);
  if (au < 0.012 && w > -0.15 && w < -0.1) v = Math.max(v, 0.5);
  const on = t % 2 < 0.35 ? 1 : 0;
  const beacon = on * Math.exp(-((au - 0.52) ** 2 + w * w) / 0.0005);
  return [v, beacon];
}

const CRATERS: [number, number, number][] = [
  [-0.32, -0.22, 0.2], [0.28, 0.3, 0.15], [0.08, -0.5, 0.1], [-0.48, 0.32, 0.13],
  [0.5, -0.12, 0.09], [-0.05, 0.08, 0.07], [0.2, 0.62, 0.08],
];
const LIGHT = (() => {
  const v = [-0.55, -0.6, 0.58];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();

/** Moon brightness at (dx, dy) in units of its radius. */
function moonAt(dx: number, dy: number): number {
  const rr = dx * dx + dy * dy;
  if (rr > 1) {
    const r = Math.sqrt(rr);
    return r < 1.25 ? 0.2 * Math.exp(-(r - 1) / 0.05) : 0;
  }
  const nz = Math.sqrt(1 - rr);
  let l = 0.08 + 0.8 * Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]);
  l *= 0.86 + 0.14 * Math.sin(dx * 4.2 + 1.3) * Math.sin(dy * 3.4 - 0.4);
  for (const [u, v, r] of CRATERS) {
    const d = Math.hypot(dx - u, dy - v) / r;
    if (d < 1) l *= 0.55 + 0.3 * d;
    else if (d < 1.2) l += 0.1;
  }
  return Math.min(1, l);
}

type Comet = { fx: number; fy: number; vx: number; vy: number; s: number; a: number; P: number; ph: number };

const COMETS: Comet[] = [
  { fx: -0.15, fy: 0.14, vx: 0.028, vy: 0.003, s: 0.16, a: 0.8, P: 48, ph: 14 },
  { fx: 1.15, fy: 0.32, vx: -0.022, vy: 0.005, s: 0.11, a: 0.55, P: 62, ph: 40 },
  { fx: -0.15, fy: 0.82, vx: 0.034, vy: -0.007, s: 0.09, a: 0.5, P: 40, ph: 2 },
  { fx: -0.15, fy: 0.5, vx: 0.019, vy: -0.004, s: 0.13, a: 0.6, P: 70, ph: 58 },
  { fx: 1.15, fy: 0.68, vx: -0.03, vy: -0.006, s: 0.1, a: 0.5, P: 52, ph: 20 },
];

/** Comet head + dust tail (white) and ion tail (blue) brightness at (x, y) in screen-height units. */
function cometAt(x: number, y: number, t: number, c: Comet, asp: number): [number, number] {
  const k = (t + c.ph) % c.P;
  const nx = (c.fx + c.vx * k) * asp;
  const ny = c.fy + c.vy * k;
  const vxh = c.vx * asp;
  const vl = Math.hypot(vxh, c.vy);
  const td = [-vxh / vl, -c.vy / vl];
  const px = (x - nx) / c.s;
  const py = (y - ny) / c.s;
  if (Math.abs(px) > 3 || Math.abs(py) > 3) return [0, 0];
  const r = Math.hypot(px, py);
  let v = Math.exp(-((r / 0.05) ** 2)) + 0.45 * Math.exp(-((r / 0.16) ** 2));
  let io = 0;
  const al = px * td[0] + py * td[1];
  const pe = px * td[1] - py * td[0];
  if (al > 0) {
    const pc = pe + 0.22 * al * al;
    const wd = 0.04 + 0.15 * al;
    v += 0.9 * Math.exp(-al / 0.7) * Math.exp(-((pc / wd) ** 2)) * (0.72 + 0.28 * Math.sin(pc * 55 - al * 7 + t * 2));
    if (Math.abs(pc) < wd * 1.4 && hash(Math.floor((al - t * 0.12) * 45), Math.floor(pc * 45)) > 0.975) v += 0.4;
    if (al > 0.07) {
      io = Math.exp(-al / 1.6) * Math.exp(-((pe / (0.014 + 0.03 * al)) ** 2)) * (0.55 + 0.45 * Math.sin(al * 20 - t * 5));
    }
  }
  return [Math.min(1, Math.pow(v, 0.75)) * c.a, io * c.a];
}

/** Sizes the canvas backing store to its CSS box × devicePixelRatio; returns a ready 2D context. */
function prepare(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.round(w * d);
  const bh = Math.round(h * d);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.setTransform(d, 0, 0, d, 0, 0);
  g.clearRect(0, 0, w, h);
  return g;
}

const glyph = (v: number, h: number) => Math.floor(Math.min(0.999, v + (h - 0.5) * 0.08) * RAMP.length);

/** Moon + orbiting satellite + twinkling stars, dimmed behind the hero text box. */
export function drawSky(canvas: HTMLCanvasElement, text: HTMLElement, t: number, pal: SkyPalette): void {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (!W || !H) return;
  const g = prepare(canvas, W, H);
  if (!g) return;
  const wide = W > WIDE_PX;
  const cell = wide ? 9 : 7;
  const tb = text.getBoundingClientRect();
  const cb = canvas.getBoundingClientRect();
  let R: number;
  let mx: number;
  let my: number;
  if (wide) {
    R = Math.min(H * 0.22, W * 0.12);
    mx = W - R * 2.45 - 30;
    my = H * 0.52;
  } else {
    const top = tb.bottom - cb.top + 16;
    const room = Math.max(170, H - 52 - top);
    R = Math.min(W * 0.17, room * 0.28);
    mx = W / 2;
    my = top + room / 2;
  }
  const th = (t / ORBIT_S) * 2 * Math.PI;
  const ca = Math.cos(-0.3);
  const sa = Math.sin(-0.3);
  const ox = Math.cos(th) * R * 1.65;
  const oy = Math.sin(th) * R * 1.1;
  const sx = mx + ox * ca - oy * sa;
  const sy = my + ox * sa + oy * ca;
  const behind = Math.sin(th) < 0;
  const SS = R * (behind ? 0.72 : 0.95);
  const sDim = behind ? 0.65 : 1;
  const tx0 = tb.left - cb.left - 20;
  const tx1 = tb.right - cb.left + 20;
  const ty0 = tb.top - cb.top - 16;
  const ty1 = tb.bottom - cb.top + 16;
  const cw = cell * 0.8;
  const chh = cell * 1.25;
  g.font = `${cell * 1.15}px ${pal.font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let y = cell / 2; y < H; y += chh) {
    for (let x = cell / 2; x < W; x += cw) {
      let v = 0;
      let hot = false;
      let solid = false;
      const ddx = (x - mx) / R;
      const ddy = (y - my) / R;
      const inMoon = ddx * ddx + ddy * ddy < 1;
      if (ddx * ddx + ddy * ddy < 1.6) {
        v = moonAt(ddx, ddy);
        solid = inMoon;
      }
      const lx = (x - sx) / SS;
      const ly = (y - sy) / SS;
      if (Math.abs(lx) < 0.8 && Math.abs(ly) < 0.45 && !(behind && inMoon)) {
        const [sv, bc] = satBody(lx, ly, t);
        if (sv > 0.05) {
          v = sv * sDim;
          solid = true;
        }
        if (bc > 0.25) {
          v = Math.max(v, bc);
          hot = true;
          solid = true;
        }
      }
      if (solid) {
        g.globalAlpha = 1;
        g.fillStyle = pal.bg;
        g.fillRect(x - cw / 2, y - chh / 2, cw + 0.5, chh + 0.5);
      }
      const h = hash(Math.round(x), Math.round(y));
      if (v < 0.05 && h > 0.993) v = 0.22 + 0.18 * Math.sin(t * 1.7 + h * 60);
      const i = glyph(v, h);
      if (i > 0) {
        const dim = x > tx0 && x < tx1 && y > ty0 && y < ty1 ? 0.28 : 1;
        g.fillStyle = hot ? pal.flame : pal.ink;
        g.globalAlpha = (0.35 + 0.65 * Math.min(1, v)) * dim;
        g.fillText(RAMP[i], x, y);
      }
    }
  }
  g.globalAlpha = 1;
}

/** Comets on a viewport-sized layer; only cells near each comet are computed. */
export function drawCosmos(canvas: HTMLCanvasElement, t: number, pal: SkyPalette): void {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const g = prepare(canvas, W, H);
  if (!g) return;
  const cell = W > WIDE_PX ? 9 : 7;
  const cw = cell * 0.8;
  const chh = cell * 1.25;
  const asp = W / H;
  g.font = `${cell * 1.15}px ${pal.font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const c of COMETS) {
    const k = (t + c.ph) % c.P;
    const hx = (c.fx + c.vx * k) * W;
    const hy = (c.fy + c.vy * k) * H;
    const ext = 3 * c.s * H;
    if (hx < -ext || hx > W + ext || hy < -ext || hy > H + ext) continue;
    const x0 = Math.max(cell / 2, Math.floor((hx - ext) / cw) * cw + cell / 2);
    const x1 = Math.min(W, hx + ext);
    const y0 = Math.max(cell / 2, Math.floor((hy - ext) / chh) * chh + cell / 2);
    const y1 = Math.min(H, hy + ext);
    for (let y = y0; y < y1; y += chh) {
      for (let x = x0; x < x1; x += cw) {
        const [cv, io] = cometAt(x / H, y / H, t, c, asp);
        let v = cv;
        let hot = false;
        if (io > 0.22 && io > cv * 0.6) {
          v = io;
          hot = true;
        }
        if (v < 0.06) continue;
        const i = glyph(v, hash(Math.round(x), Math.round(y)));
        if (i > 0) {
          g.fillStyle = hot ? pal.flame : pal.ink;
          g.globalAlpha = (0.3 + 0.6 * Math.min(1, v)) * 0.8;
          g.fillText(RAMP[i], x, y);
        }
      }
    }
  }
  g.globalAlpha = 1;
}
