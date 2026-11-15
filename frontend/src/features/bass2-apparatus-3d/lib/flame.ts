// No runtime imports: node:test loads this file directly. Geometry and report constants are passed in.
import type { ConfigId, LAYOUT, Level, Regime } from "../content";

type Look = NonNullable<Level["flame"]>;

/** Constants the shape needs; the scene passes them from content.ts. */
export interface FlameGeometry {
  layout: typeof LAYOUT;
  /** Oscillation before quenching, Hz (p.72). */
  preQuenchHz: number;
  /** Stretch rate at the minimum of Eq. 6.1, 1/s. */
  aAtMinimum: number;
  /** Rod in concurrent flow: stretch rates between which the flame turns from blue to luminous (illustrative). */
  rodSoot: { fromA: number; toA: number };
}

// State machine of the schematic flame. Phase order and what triggers each change follow the report;
// every duration here is schematic (the dataset has no time series).

export type Phase = "igniting" | "burning" | "quenching" | "blowing" | "out";
export type OutReason = "quench" | "blowoff" | "no-ignition" | "loop-end";

export interface FlameState {
  phase: Phase;
  /** Seconds spent in the current phase. */
  t: number;
  /** 0..1: how far the flame has travelled along the sample (spreading configurations only). */
  progress: number;
  reason: OutReason | null;
}

/** Schematic durations, s. */
export const DURATION = { igniting: 1.8, quenching: 4.6, blowing: 3.4, spread: 16, rest: 2.4 } as const;

export interface StepInput {
  regime: Regime;
  /** false below the ignition limit (rod in concurrent flow, p.68). */
  ignitable: boolean;
  /** The flame travels along the sample (all configurations but the rod in concurrent flow). */
  spreads: boolean;
  /** Restart after the flame reaches the end of the sample. */
  loop: boolean;
}

export const ignite = (): FlameState => ({ phase: "igniting", t: 0, progress: 0, reason: null });

/** Advance the flame by dt seconds. Pure: the same state and input always give the same result. */
export function step(s: FlameState, dt: number, input: StepInput): FlameState {
  const t = s.t + dt;
  switch (s.phase) {
    case "igniting":
      if (t < DURATION.igniting) return { ...s, t };
      if (input.regime === "burning" && input.ignitable) return { phase: "burning", t: 0, progress: 0, reason: null };
      return { phase: "out", t: 0, progress: 0, reason: "no-ignition" };
    case "burning": {
      if (input.regime === "quench") return { ...s, phase: "quenching", t: 0 };
      if (input.regime === "blowoff") return { ...s, phase: "blowing", t: 0 };
      if (!input.spreads) return { ...s, t };
      const progress = s.progress + dt / DURATION.spread;
      if (progress >= 1) return { phase: "out", t: 0, progress: 1, reason: "loop-end" };
      return { ...s, t, progress };
    }
    case "quenching":
    case "blowing": {
      // turning the flow back in time restabilises the flame (done once after a local blowoff, p.73)
      if (input.regime === "burning") return { ...s, phase: "burning", t: 0 };
      const other = input.regime === "quench" ? "quenching" : "blowing";
      if (other !== s.phase) return { ...s, phase: other, t: 0 };
      const total = s.phase === "quenching" ? DURATION.quenching : DURATION.blowing;
      if (t < total) return { ...s, t };
      return { ...s, phase: "out", t: 0, reason: s.phase === "quenching" ? "quench" : "blowoff" };
    }
    case "out":
      if (input.loop && s.reason === "loop-end" && t >= DURATION.rest) return ignite();
      return { ...s, t };
  }
}

/** Where the flame sits and how big it is, in scene millimetres. All of it is schematic. */
export interface FlameShape {
  visible: boolean;
  /** Upstream end of the flame on the flow axis. */
  noseX: number;
  length: number;
  height: number;
  width: number;
  /** Closed downstream tip (rod in opposed flow at higher flow, Fig. 1.2c). */
  closed: boolean;
  /** 0..1: fraction of the flame length opened up from the nose (blowoff hole at the stagnation region). */
  hole: number;
  opacity: number;
  /** 0..1: how much of the downstream part glows yellow (luminous soot) instead of blue. Illustrative. */
  soot: number;
}

const HIDDEN: FlameShape = { visible: false, noseX: 0, length: 1, height: 1, width: 1, closed: false, hole: 0, opacity: 0, soot: 0 };
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Position of the flame's leading point for the spreading configurations. */
export function frontX(config: ConfigId, progress: number, LAYOUT: FlameGeometry["layout"]): number {
  const p = clamp01(progress);
  switch (config) {
    case "flat":
      return LAYOUT.flat.halfLength - p * (2 * LAYOUT.flat.halfLength - 12);
    case "rod-opposed":
      return LAYOUT.rodOpposed.endX - 6 - p * (LAYOUT.rodOpposed.endX - LAYOUT.rodOpposed.startX - 22);
    case "fabric":
      return -LAYOUT.fabric.halfLength + p * (2 * LAYOUT.fabric.halfLength - 20);
    case "rod-concurrent":
      return LAYOUT.rodConcurrent.tipX;
  }
}

export interface ShapeInput {
  config: ConfigId;
  flame: FlameState;
  /** Rod in concurrent flow: stretch rate and rod radius. */
  a: number;
  rodRadiusMm: number;
  /** Other configurations: look of the chosen flow level, or of the last burning one while going out. */
  look: Look | null;
  geometry: FlameGeometry;
}

/** Steady flame of the rod in concurrent flow: a cup round the tip that grows with the flow. */
function rodCup(a: number, r: number, g: FlameGeometry): { noseX: number; length: number; width: number } {
  const LAYOUT = g.layout;
  const width = 2 * (r + LAYOUT.standoff + 1.6);
  // aspect ratio L/W goes to 0.5 (a hemisphere) at the quenching limit (p.70) and grows with the flow
  const grow = clamp01(Math.log(Math.max(a, 1) / (g.aAtMinimum / 4)) / Math.log(60));
  return { noseX: LAYOUT.rodConcurrent.tipX - LAYOUT.standoff, length: width * (0.5 + 1.9 * grow), width };
}

/** Rod in concurrent flow: blue near the quenching limit (Fig. 6.3 a-c), luminous toward blowoff (Fig. 6.3 d, f). */
const rodSoot = (a: number, g: FlameGeometry) => clamp01((a - g.rodSoot.fromA) / (g.rodSoot.toA - g.rodSoot.fromA));

export function flameShape({ config, flame, a, rodRadiusMm, look, geometry }: ShapeInput): FlameShape {
  if (flame.phase === "out") return HIDDEN;
  const LAYOUT = geometry.layout;

  let base: FlameShape;
  if (config === "rod-concurrent") {
    const cup = rodCup(a, rodRadiusMm, geometry);
    base = { visible: true, noseX: cup.noseX, length: cup.length, height: cup.width, width: cup.width, closed: false, hole: 0, opacity: 1, soot: rodSoot(a, geometry) };
  } else {
    if (!look) return HIDDEN;
    const front = frontX(config, flame.progress, LAYOUT);
    let noseX = front - 2;
    let length = look.length;
    if (config === "rod-opposed") {
      // the flame wraps the rod from its leading edge to past the burning end
      length = LAYOUT.rodOpposed.endX - front + look.length;
      noseX = front - 1.5;
    }
    base = { visible: true, noseX, length, height: look.height, width: look.width, closed: look.closed, hole: 0, opacity: look.opacity, soot: look.soot };
  }

  switch (flame.phase) {
    case "igniting": {
      // a small flame shows while the igniter is on (p.68)
      const k = clamp01((flame.t - 0.55 * DURATION.igniting) / (0.45 * DURATION.igniting));
      if (k <= 0) return HIDDEN;
      const s = 0.45 + 0.55 * k;
      return { ...base, length: base.length * s, height: base.height * s, width: base.width * s, opacity: base.opacity * k };
    }
    case "burning":
      return base;
    case "quenching": {
      const k = clamp01(flame.t / DURATION.quenching);
      // shrinks toward a hemisphere (L/W = 0.5); the 1.1 Hz oscillation was measured on the rod in concurrent flow
      const osc = config === "rod-concurrent" ? (0.03 + 0.12 * k) * Math.sin(2 * Math.PI * geometry.preQuenchHz * flame.t) : 0;
      const size = lerp(1, 0.72, k) * (1 + osc);
      const length = lerp(base.length, 0.5 * base.width, k) * size;
      return {
        ...base,
        closed: false,
        length,
        height: base.height * size,
        width: base.width * size,
        opacity: base.opacity * (1 - clamp01((k - 0.86) / 0.14)),
        // "loses its orange colour, turns completely blue and goes out" (p.13)
        soot: base.soot * (1 - clamp01(k / 0.6)),
      };
    }
    case "blowing": {
      const k = clamp01(flame.t / DURATION.blowing);
      // the hole opens at the stagnation region, then the leading edge wanders downstream (p.73)
      const wander = 4 * k * Math.sin(2 * Math.PI * 0.9 * flame.t);
      return {
        ...base,
        closed: false,
        hole: 0.2 * clamp01(flame.t / 0.9),
        noseX: base.noseX + 0.6 * (5 * k + wander),
        opacity: base.opacity * (1 - clamp01((k - 0.78) / 0.22)),
      };
    }
  }
}

export interface ReplayShapeInput {
  config: ConfigId;
  /** 0..1 flame presence from the video's bright-pixel count (estimate); 0 = no flame drawn. */
  presence: number;
  /** Air-speed display, cm/s (estimate from the overlay); null while unreadable. */
  airCmS: number | null;
  /** Rod in concurrent flow: stretch rate from the air display and the rod's radius. */
  a: number;
  rodRadiusMm: number;
  look: Look | null;
  geometry: FlameGeometry;
}

/**
 * Flame while replaying a real test. Presence and brightness come from the video; everything about the
 * shape is schematic: the rod cup follows the stretch rate as in the model, a flat flame sits at a fixed
 * place on the sample (its spread was not tracked) and loses its luminous tail as the flow drops.
 */
export function replayFlameShape({ config, presence, airCmS, a, rodRadiusMm, look, geometry }: ReplayShapeInput): FlameShape {
  if (presence <= 0) return HIDDEN;
  const LAYOUT = geometry.layout;
  if (config === "rod-concurrent") {
    const cup = rodCup(a, rodRadiusMm, geometry);
    return { visible: true, noseX: cup.noseX, length: cup.length, height: cup.width, width: cup.width, closed: false, hole: 0, opacity: presence, soot: rodSoot(a, geometry) };
  }
  if (!look) return HIDDEN;
  const front = frontX(config, 0.45, LAYOUT);
  const slow = clamp01((airCmS ?? 0) / 3); // schematic: the yellow tail fades as the flow is lowered (p.13)
  const size = lerp(0.72, 1, slow);
  return {
    visible: true,
    noseX: front - 2,
    length: config === "rod-opposed" ? LAYOUT.rodOpposed.endX - front + look.length : look.length * size,
    height: look.height * size,
    width: look.width * size,
    closed: look.closed && slow > 0.5,
    hole: 0,
    opacity: presence,
    soot: look.soot * slow,
  };
}
