import { useSyncExternalStore } from "react";
import { Playback } from "@/shared/three/playback";
import {
  CONFIGS,
  FLAME_VISIBLE_PX,
  FLOW,
  LAYOUT,
  O2,
  PRE_QUENCH_HZ,
  REPLAY_SPEEDS,
  ROD_RADII_CM,
  ROD_SOOT,
  type ConfigId,
  type Level,
  type Regime,
  type ReplayTest,
} from "../content";
import { A_AT_MINIMUM, canIgnite, rodRegime, stretchRate } from "./boundary";
import { flameShape, ignite, replayFlameShape, step, type FlameGeometry, type FlameShape, type FlameState } from "./flame";
import { sample, visibility, type ReplayModel } from "./replay";

export type Mode = "model" | "replay";

/** Conditions of a replayed test, from the tests table (never from the log text). */
export interface ReplayRowLite {
  test_id: string;
  material: string;
  thickness_mm: number | null;
  diameter_mm: number | null;
  o2_initial_pct: number | null;
  outcome: string | null;
}

export interface Replay {
  test: ReplayTest;
  row: ReplayRowLite;
  model: ReplayModel;
  playback: Playback;
}

/** What the scene draws this frame, whichever mode is on. */
export interface SceneView {
  config: ConfigId;
  flame: FlameShape;
  /** Flow speed that drives the tracers and the fan, cm/s (replay: the air display, estimate). */
  tracerCmS: number;
  igniterOn: boolean;
  /** Seconds the igniter has been on (for its glow ramp). */
  igniterT: number;
}

const FLAME_GEOMETRY: FlameGeometry = { layout: LAYOUT, preQuenchHz: PRE_QUENCH_HZ, aAtMinimum: A_AT_MINIMUM, rodSoot: ROD_SOOT };

/**
 * State of the simulation. The 3D scene reads `view()` every frame; the HUD subscribes with useSim and
 * re-renders only when a setting or the flame phase changes. In replay mode the clock is the shared
 * Playback and the flame follows the video series.
 */
export class Sim {
  mode: Mode = "model";
  replay: Replay | null = null;
  config: ConfigId = "rod-concurrent";
  /** Rod in concurrent flow: flow speed, cm/s. */
  u: number = FLOW.ignitionCmS;
  /** Rod in concurrent flow: O2, % by volume. */
  o2: number = O2.start;
  radiusIndex = 0;
  /** Chosen qualitative flow level of each other configuration. */
  levelIndex: Record<ConfigId, number> = {
    flat: CONFIGS.flat.startLevel,
    "rod-concurrent": 0,
    "rod-opposed": CONFIGS["rod-opposed"].startLevel,
    fabric: CONFIGS.fabric.startLevel,
  };
  flame: FlameState;
  /** false while offscreen: the clock stops. */
  active = true;
  /** prefers-reduced-motion: no spreading loop, no autoplay, the flame stays where it is. */
  readonly reducedMotion: boolean;

  private listeners = new Set<() => void>();
  private version = 0;
  private raf = 0;
  private last = 0;

  constructor(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
    this.flame = this.restFlame();
  }

  /** With reduced motion the scene opens on a burning flame instead of playing the ignition. */
  private restFlame(): FlameState {
    if (!this.reducedMotion) return ignite();
    return this.regime === "burning"
      ? { phase: "burning", t: 0, progress: 0.4, reason: null }
      : { phase: "out", t: 0, progress: 0, reason: this.regime === "quench" ? "quench" : "blowoff" };
  }

  /** Rod radius, cm: in a replay from the test's diameter (tests table), else the chosen size. */
  get rodRadiusCm(): number {
    const d = this.replay?.row.diameter_mm;
    return this.mode === "replay" && d != null ? d / 20 : ROD_RADII_CM[this.radiusIndex];
  }
  /** Flat sample thickness, mm: in a replay from the tests table, drawn no thinner than the schematic minimum. */
  get sampleThicknessMm(): number {
    const t = this.replay?.row.thickness_mm;
    return this.mode === "replay" && t != null ? Math.max(t, LAYOUT.flat.thickness) : LAYOUT.flat.thickness;
  }
  get stretch(): number {
    return stretchRate(this.u, this.rodRadiusCm);
  }
  get level(): Level | null {
    return CONFIGS[this.config].levels[this.levelIndex[this.config]] ?? null;
  }
  get regime(): Regime {
    return this.config === "rod-concurrent" ? rodRegime(this.u, this.rodRadiusCm, this.o2) : (this.level?.regime ?? "burning");
  }
  get ignitable(): boolean {
    return this.config !== "rod-concurrent" || canIgnite(this.o2, O2.ignitionLimit);
  }
  /** Flame look for the scene: the chosen level's, or the last burning level's while the flame goes out. */
  get look(): NonNullable<Level["flame"]> | null {
    return this.level?.flame ?? CONFIGS[this.config].levels.find((l) => l.flame)?.flame ?? null;
  }
  /** Flow speed that drives the tracers, cm/s. */
  get tracerCmS(): number {
    if (this.mode === "replay" && this.replay) return this.replayAir() ?? 0;
    return this.config === "rod-concurrent" ? this.u : (this.level?.tracerCmS ?? 0);
  }

  /** Replay: the air display at the clock's time, cm/s; null outside the record or across an unreadable stretch. */
  replayAir(): number | null {
    const r = this.replay;
    return r ? sample(r.model.air, r.playback.t) : null;
  }
  /** Replay: bright pixels in the video at the clock's time. */
  replayScenePx(): number | null {
    const r = this.replay;
    return r ? sample(r.model.scene, r.playback.t) : null;
  }
  /** Replay: flame presence 0..1 from the bright-pixel count. */
  replayPresence(): number {
    const r = this.replay;
    return r ? visibility(this.replayScenePx(), FLAME_VISIBLE_PX, r.model.sceneMax) : 0;
  }

  /** Everything the scene draws this frame. */
  view(): SceneView {
    if (this.mode === "replay" && this.replay) {
      const air = this.replayAir();
      const a = stretchRate(air ?? 0, this.rodRadiusCm);
      return {
        config: this.config,
        flame: replayFlameShape({
          config: this.config,
          presence: this.replayPresence(),
          airCmS: air,
          a,
          rodRadiusMm: this.rodRadiusCm * 10,
          look: this.look,
          geometry: FLAME_GEOMETRY,
        }),
        tracerCmS: air ?? 0,
        igniterOn: false,
        igniterT: 0,
      };
    }
    return {
      config: this.config,
      flame: flameShape({
        config: this.config,
        flame: this.flame,
        a: this.stretch,
        rodRadiusMm: this.rodRadiusCm * 10,
        look: this.look,
        geometry: FLAME_GEOMETRY,
      }),
      tracerCmS: this.tracerCmS,
      igniterOn: this.flame.phase === "igniting",
      igniterT: this.flame.t,
    };
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (this.active) this.tick(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(this.raf);
  }

  private tick(dt: number) {
    if (this.mode === "replay") {
      this.replay?.playback.tick(dt);
      return;
    }
    const before = this.flame;
    this.flame = step(before, dt, {
      regime: this.regime,
      ignitable: this.ignitable,
      spreads: this.config !== "rod-concurrent" && !this.reducedMotion,
      loop: !this.reducedMotion,
    });
    if (this.flame.phase !== before.phase) this.emit();
  }

  setConfig(config: ConfigId) {
    if (config === this.config) return;
    this.config = config;
    this.flame = this.restFlame();
    this.emit();
  }
  setFlow(u: number) {
    this.u = Math.min(FLOW.maxCmS, Math.max(FLOW.minCmS, u));
    this.changed();
  }
  setO2(o2: number) {
    this.o2 = Math.min(O2.max, Math.max(O2.min, o2));
    this.changed();
  }
  setRadius(index: number) {
    this.radiusIndex = index;
    this.changed();
  }
  setLevel(index: number) {
    this.levelIndex = { ...this.levelIndex, [this.config]: index };
    this.changed();
  }
  /** Set flow and O2 together and light the sample: the "try it" buttons. */
  preset(u: number, o2: number) {
    this.u = Math.min(FLOW.maxCmS, Math.max(FLOW.minCmS, u));
    this.o2 = Math.min(O2.max, Math.max(O2.min, o2));
    this.flame = ignite();
    this.emit();
  }
  ignite() {
    this.flame = ignite();
    this.emit();
  }

  /** Switch to a replayed test (or back to the schematic model with null). */
  setReplay(replay: { test: ReplayTest; row: ReplayRowLite; model: ReplayModel } | null) {
    if (!replay) {
      if (this.mode === "model") return;
      this.replay = null;
      this.mode = "model";
      this.flame = this.restFlame();
      this.emit();
      return;
    }
    const playback = new Playback(replay.model.tMin, replay.model.tMax, !this.reducedMotion, replay.model.tMin);
    playback.speed = REPLAY_SPEEDS[1];
    playback.loop = false;
    playback.active = this.active;
    this.replay = { ...replay, playback };
    this.mode = "replay";
    this.config = replay.test.config;
    this.emit();
  }

  setActive(active: boolean) {
    this.active = active;
    if (this.replay) this.replay.playback.active = active;
  }

  /** After a setting change: a flame that went out relights by itself once the setting can burn again. */
  private changed() {
    const out = this.flame.phase === "out" && this.flame.reason !== "loop-end";
    if (out && this.regime === "burning" && this.ignitable) this.flame = ignite();
    this.emit();
  }

  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
}

/** Re-renders on every setting or phase change and returns the simulation itself. */
export function useSim(sim: Sim): Sim {
  useSyncExternalStore(sim.subscribe, sim.getVersion);
  return sim;
}
