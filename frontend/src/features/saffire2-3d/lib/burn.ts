// What each sample looks like at a moment: igniter, flame, burned length. Rules come from the
// scene passport (docs/decisions/0011-saffire2-3d-replay.md). Data vs estimate is kept explicit.
// No imports from "@/": runs under node --test.

export const SAMPLE_LENGTH_MM = 290; // Readme: samples 5 cm × 29 cm
export const ANCHOR_MM = 20; // schematic: length of the flame held at the base (Note 4 gives no size)

export type BurnInput = {
  material: string;
  burnTimeS: number | null; // table: burn time
  ugBurnCm: number | null; // table: burned length in µg
  spreadLo: number | null; // table: spread rate, mm/s
  spreadHi: number | null;
  spreadNote: string; // "Note 4" = flame anchored at the base
};

export type BurnMode = "spread" | "anchored" | "none";

export type BurnState = {
  mode: BurnMode;
  /** flame present now (between ignition and the table burn time) */
  flame: boolean;
  /** flame zone along the sample from the igniter end, mm (estimate) */
  flameFrom: number;
  flameTo: number;
  /** charred length from the igniter end, mm (estimate while burning, table value after) */
  burned: number;
};

export function burnMode(b: BurnInput): BurnMode {
  if (!b.ugBurnCm || b.ugBurnCm <= 0 || !b.burnTimeS) return "none";
  if (b.spreadNote === "Note 4") return "anchored";
  return "spread";
}

/** Front speed in mm/s: the table rate when it is one number, else burned length / burn time. */
export function frontRate(b: BurnInput): number | null {
  if (!b.ugBurnCm || !b.burnTimeS) return null;
  if (b.spreadLo != null && b.spreadLo === b.spreadHi) return b.spreadLo;
  return (b.ugBurnCm * 10) / b.burnTimeS;
}

/**
 * State at `tIgn` seconds from this sample's ignition. `null` = before this recording started
 * (nothing burned yet); `Infinity` = after the recording (final table state).
 */
export function burnAt(b: BurnInput, tIgn: number | null): BurnState {
  const mode = burnMode(b);
  const final = Math.min(SAMPLE_LENGTH_MM, (b.ugBurnCm ?? 0) * 10);
  const none: BurnState = { mode, flame: false, flameFrom: 0, flameTo: 0, burned: 0 };
  if (tIgn == null || mode === "none") return tIgn === Infinity ? { ...none, burned: final } : none;
  if (tIgn < 0) return none;
  const end = b.burnTimeS ?? 0;
  if (tIgn >= end) return { ...none, burned: final };
  if (mode === "anchored") {
    const burned = (final * tIgn) / end;
    return { mode, flame: true, flameFrom: 0, flameTo: Math.min(ANCHOR_MM, Math.max(burned, 5)), burned };
  }
  const rate = frontRate(b) ?? 0;
  const front = Math.min(final, rate * tIgn);
  return { mode, flame: true, flameFrom: Math.max(0, front - 30), flameTo: Math.max(front, 4), burned: front };
}
