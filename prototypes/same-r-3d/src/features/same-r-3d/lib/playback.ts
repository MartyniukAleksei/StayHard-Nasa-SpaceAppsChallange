// Copied unchanged from frontend/src/features/experiment-3d/lib/playback.ts; see the note in series.ts.
import { useSyncExternalStore } from "react";

/** Playback clock. The 3D scene reads `t` directly every frame; the HUD subscribes with the hook. */
export class Playback {
  t: number;
  playing: boolean;
  speed = 1;
  /** false while the replay is offscreen: the clock and the renderer both stop. */
  active = true;
  readonly tMin: number;
  readonly tMax: number;
  private listeners = new Set<() => void>();
  private raf = 0;
  private last = 0;
  private version = 0;

  constructor(tMin: number, tMax: number, autoplay: boolean, startAt = tMin) {
    this.tMin = tMin;
    this.tMax = tMax;
    this.t = startAt;
    this.playing = autoplay;
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (this.playing && this.active) {
        this.t += dt * this.speed;
        if (this.t > this.tMax) this.t = this.tMin; // loop
        this.emit();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(this.raf);
  }

  seek(t: number) {
    this.t = Math.min(this.tMax, Math.max(this.tMin, t));
    this.emit();
  }

  toggle() {
    this.playing = !this.playing;
    this.emit();
  }

  setSpeed(speed: number) {
    this.speed = speed;
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

/** Re-renders the component on every clock change and returns the clock itself. */
export function usePlayback(p: Playback): Playback {
  useSyncExternalStore(p.subscribe, p.getVersion);
  return p;
}
