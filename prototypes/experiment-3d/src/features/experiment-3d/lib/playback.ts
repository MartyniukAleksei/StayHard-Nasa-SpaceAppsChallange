import { useSyncExternalStore } from "react";

/** Годинник відтворення. Сцена читає `t` напряму в кожному кадрі, HUD підписується через хук. */
export class Playback {
  t: number;
  playing = true;
  speed = 1;
  private listeners = new Set<() => void>();
  private raf = 0;
  private last = 0;
  private version = 0;

  constructor(
    readonly tMin: number,
    readonly tMax: number,
  ) {
    this.t = tMin;
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (this.playing) {
        this.t += dt * this.speed;
        if (this.t > this.tMax) this.t = this.tMin; // цикл
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

/** Перерендерює компонент на кожну зміну годинника і повертає сам об'єкт. */
export function usePlayback(p: Playback): Playback {
  useSyncExternalStore(p.subscribe, p.getVersion);
  return p;
}
