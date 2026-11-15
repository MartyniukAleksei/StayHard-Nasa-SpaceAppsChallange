import { useSyncExternalStore } from "react";

const SPEED_RAMP_S = 0.4;
const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/** Playback clock. The 3D scene reads `t` directly every frame; the HUD subscribes with the hook. */
export class Playback {
  t: number;
  playing: boolean;
  speed = 1;
  /** false while the replay is offscreen: the clock and the renderer both stop. */
  active = true;
  /** false during a guided tour: the clock stops at the end of the data and does not start over. */
  loop = true;
  /** true while a guided tour is paused: nothing moves, a fast-forward included. */
  frozen = false;
  readonly tMin: number;
  readonly tMax: number;
  private listeners = new Set<() => void>();
  private raf = 0;
  private last = 0;
  private version = 0;
  private scrub: { from: number; to: number; duration: number; elapsed: number } | null = null;
  private ramp: { target: number; rate: number } | null = null;

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
      this.tick(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(this.raf);
  }

  /** Advances the clock by dt seconds of real time. `start()` calls it every animation frame. */
  tick(dt: number) {
    if (!this.active || this.frozen) return;
    if (this.scrub) {
      const s = this.scrub;
      s.elapsed = Math.min(s.duration, s.elapsed + dt);
      this.t = s.from + (s.to - s.from) * easeInOutCubic(s.elapsed / s.duration);
      if (s.elapsed >= s.duration) this.scrub = null;
      this.emit();
      return;
    }
    if (!this.playing) return;
    if (this.ramp) {
      const gap = this.ramp.target - this.speed;
      const step = this.ramp.rate * dt;
      if (Math.abs(gap) <= step) {
        this.speed = this.ramp.target;
        this.ramp = null;
      } else this.speed += Math.sign(gap) * step;
    }
    this.t += dt * this.speed;
    if (this.t > this.tMax) {
      if (this.loop) this.t = this.tMin;
      else {
        this.t = this.tMax;
        this.playing = false;
      }
    }
    this.emit();
  }

  seek(t: number) {
    this.scrub = null;
    this.t = Math.min(this.tMax, Math.max(this.tMin, t));
    this.emit();
  }

  /** Runs the clock to t over durationS with easing, forwards or backwards: a fast-forward the scene
   *  draws frame by frame instead of a jump. */
  scrubTo(t: number, durationS: number) {
    const to = Math.min(this.tMax, Math.max(this.tMin, t));
    if (durationS <= 0 || Math.abs(to - this.t) < 1e-6) return this.seek(to);
    this.scrub = { from: this.t, to, duration: durationS, elapsed: 0 };
    this.emit();
  }

  get scrubbing() {
    return this.scrub != null;
  }

  toggle() {
    this.playing = !this.playing;
    this.emit();
  }

  setSpeed(speed: number) {
    this.ramp = null;
    this.speed = speed;
    this.emit();
  }

  /** Changes the speed gradually (about 0.4 s) instead of at once. */
  rampSpeed(target: number) {
    const gap = Math.abs(target - this.speed);
    this.ramp = gap < 1e-6 ? null : { target, rate: gap / SPEED_RAMP_S };
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
