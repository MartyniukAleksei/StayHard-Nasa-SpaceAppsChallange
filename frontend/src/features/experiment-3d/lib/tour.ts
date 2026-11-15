// Guided tour of the 3D replay: the agent's `tour` event (docs/agent/ui-actions.md) turned into a
// timeline and played on the playback clock. The spec arrives through sessionStorage, the `?tour=`
// URL parameter and the `agent:tour` window event; features do not import each other.
import type { Playback } from "./playback.ts";

export type TourObject = "droplet" | "flame_color" | "flame_uv" | "trail" | "needles" | "igniters" | "frame";
export type TourCamera = "overview" | "flame" | "droplet" | "camera_view";

export interface TourLabel {
  at: TourObject;
  /** Final text: the numbers were filled in by the backend from the data. */
  text: string;
  tags: string[];
  source: number | null;
}

export interface TourStep {
  moment: string;
  /** Seconds from ignition. */
  t: number;
  action: "play" | "pause";
  speed: number;
  camera: TourCamera;
  focus: TourObject[];
  show_frame: boolean;
  labels: TourLabel[];
}

export interface TourSpec {
  id: string;
  test_no: number;
  steps: TourStep[];
  sources: { url: string; title: string }[];
}

export const TOUR_EVENT = "agent:tour";
export const tourKey = (id: string) => `flame.tour.${id}`;

const OBJECTS = ["droplet", "flame_color", "flame_uv", "trail", "needles", "igniters", "frame"];
const CAMERAS = ["overview", "flame", "droplet", "camera_view"];

/** null for anything that is not a well-formed tour: the scene then plays as usual. */
export function parseTour(raw: string | null | undefined): TourSpec | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  const spec = v as Partial<TourSpec> | null;
  if (!spec || typeof spec.id !== "string" || !Number.isInteger(spec.test_no) || !Array.isArray(spec.steps)) return null;
  const ok = spec.steps.every(
    (s) =>
      s &&
      Number.isFinite(s.t) &&
      (s.action === "play" || s.action === "pause") &&
      CAMERAS.includes(s.camera) &&
      Array.isArray(s.focus) &&
      s.focus.every((f) => OBJECTS.includes(f)) &&
      Array.isArray(s.labels) &&
      s.labels.every((l) => l && typeof l.text === "string" && OBJECTS.includes(l.at) && Array.isArray(l.tags)),
  );
  if (!ok || spec.steps.length === 0) return null;
  return { id: spec.id, test_no: spec.test_no!, steps: spec.steps, sources: Array.isArray(spec.sources) ? spec.sources : [] };
}

export function readTour(storage: Pick<Storage, "getItem"> | undefined, id: string | null): TourSpec | null {
  if (!id) return null;
  try {
    return parseTour(storage?.getItem(tourKey(id)));
  } catch {
    return null; // storage blocked: no tour, the replay still works
  }
}

export const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const HOLD_MIN_S = 2.5;
export const HOLD_MAX_S = 6;
/** How long a step stays on screen: reading time of its labels, 2.5–6 s. */
export function holdSeconds(step: TourStep): number {
  const chars = step.labels.reduce((n, l) => n + l.text.length, 0);
  return clamp(1.2 + chars * 0.055, HOLD_MIN_S, HOLD_MAX_S);
}

export const TRAVEL_MIN_S = 1.2;
export const TRAVEL_MAX_S = 3;
/** How long the clock and the camera take to reach a step: longer for a longer stretch of data. */
export function travelSeconds(fromT: number, toT: number): number {
  return clamp(TRAVEL_MIN_S + 0.3 * Math.sqrt(Math.abs(toT - fromT)), TRAVEL_MIN_S, TRAVEL_MAX_S);
}

export interface TimelineItem {
  step: number;
  travelS: number;
  holdS: number;
}

/** Spec → what happens when: for each step, travel to its moment, then hold on it. */
export function buildTimeline(spec: TourSpec, startT: number): TimelineItem[] {
  let from = startT;
  return spec.steps.map((s, step) => {
    const item = { step, travelS: travelSeconds(from, s.t), holdS: holdSeconds(s) };
    // a "play" step lets time run while it is held, so the next travel starts later in the data
    from = s.action === "play" ? s.t + item.holdS * s.speed : s.t;
    return item;
  });
}

export type TourPhase = "waiting" | "travel" | "hold" | "done";

/** Plays a tour on the playback clock. The 3D scene and the HUD read its state; `update` only
 *  talks to the clock, so it runs under node:test without a browser. */
export class TourRunner {
  readonly spec: TourSpec;
  readonly playback: Playback;
  readonly reducedMotion: boolean;
  index = 0;
  phase: TourPhase = "waiting";
  paused = false;
  /** Grows by one on every travel: the scene starts a new camera flight when it changes. */
  flight = 0;
  travelS = 0;
  private holdS = 0;
  private elapsed = 0;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(spec: TourSpec, playback: Playback, reducedMotion = false) {
    this.spec = spec;
    this.playback = playback;
    this.reducedMotion = reducedMotion;
  }

  get step(): TourStep {
    return this.spec.steps[this.index];
  }

  /** Labels are shown while the step is held (and stay on the last step). */
  get labelsVisible(): boolean {
    return this.phase === "hold" || this.phase === "done";
  }

  /** The scene is drawn and the frames of the first step are loaded: take over the clock and go. */
  begin() {
    if (this.phase !== "waiting") return;
    this.playback.loop = false;
    this.enter(0);
  }

  private enter(index: number) {
    const p = this.playback;
    this.index = index;
    this.phase = "travel";
    this.paused = false;
    p.frozen = false;
    this.elapsed = 0;
    this.flight++;
    p.playing = false;
    p.setSpeed(1);
    // reduced motion: no fast-forward and no camera flight, the scene cuts to the step
    this.travelS = this.reducedMotion ? 0.2 : travelSeconds(p.t, this.step.t);
    p.scrubTo(this.step.t, this.reducedMotion ? 0 : this.travelS);
    this.holdS = holdSeconds(this.step);
    this.emit();
  }

  private hold() {
    const p = this.playback;
    this.phase = "hold";
    this.elapsed = 0;
    if (this.step.action === "play") {
      p.setSpeed(0);
      p.playing = true;
      p.rampSpeed(this.reducedMotion ? Math.min(1, this.step.speed) : this.step.speed);
    }
    this.emit();
  }

  /** dt: seconds of real time since the last call. */
  update(dt: number) {
    if (this.paused || this.phase === "waiting" || this.phase === "done" || !this.playback.active) return;
    this.elapsed += dt;
    if (this.phase === "travel") {
      if (this.elapsed >= this.travelS && !this.playback.scrubbing) this.hold();
      return;
    }
    if (this.elapsed < this.holdS) return;
    if (this.index + 1 < this.spec.steps.length) this.enter(this.index + 1);
    else {
      this.phase = "done";
      this.playback.playing = false;
      this.playback.setSpeed(1);
      this.emit();
    }
  }

  togglePause() {
    if (this.phase === "waiting" || this.phase === "done") return;
    const p = this.playback;
    this.paused = !this.paused;
    p.frozen = this.paused;
    this.emit();
  }

  next() {
    if (this.phase === "waiting") return;
    if (this.index + 1 < this.spec.steps.length) this.enter(this.index + 1);
  }

  replay() {
    if (this.phase !== "waiting") this.enter(0);
  }

  /** Hands the clock back: the replay plays and loops as it does without a tour. */
  release() {
    const p = this.playback;
    p.frozen = false;
    p.loop = true;
    p.setSpeed(1);
    p.playing = !this.reducedMotion;
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
