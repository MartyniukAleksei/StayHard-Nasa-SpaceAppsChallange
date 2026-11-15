import { useSyncExternalStore } from "react";
import { CONFIGS, FLOW, O2, ROD_RADII_CM, type ConfigId, type Level, type Regime } from "../content";
import { canIgnite, rodRegime, stretchRate } from "./boundary";
import { ignite, step, type FlameState } from "./flame";

/**
 * State of the schematic simulation. The 3D scene reads the fields every frame; the HUD subscribes
 * with useSim and re-renders only when a setting or the flame phase changes.
 */
export class Sim {
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
  /** prefers-reduced-motion: no spreading loop, the flame stays where it is. */
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

  get rodRadiusCm(): number {
    return ROD_RADII_CM[this.radiusIndex];
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
    return this.config === "rod-concurrent" ? this.u : (this.level?.tracerCmS ?? 0);
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
  ignite() {
    this.flame = ignite();
    this.emit();
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
