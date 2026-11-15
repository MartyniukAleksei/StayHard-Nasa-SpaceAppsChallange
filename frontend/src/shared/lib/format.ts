// Display formatting only: never changes the value, only how it reads.

export const DASH = "—";

export function num(v: number | null | undefined, digits = 2, unit = ""): string {
  if (v == null || Number.isNaN(v)) return DASH;
  return unit ? `${v.toFixed(digits)} ${unit}` : v.toFixed(digits);
}

/** Mole fraction → percent: 0.21 → "21%", 0.205 → "20.5%". */
export function pct(x: number | null | undefined): string {
  if (x == null) return DASH;
  const p = Math.round(x * 1000) / 10;
  return `${Number.isInteger(p) ? p.toFixed(0) : p.toFixed(1)}%`;
}

const SUBSCRIPT: Record<string, string> = { "2": "₂", "6": "₆" };

/** "CO2" → "CO₂", "N2" → "N₂". */
export const chem = (s: string) =>
  s.replace(/([A-Z][a-z]?)(\d)/g, (_, el: string, n: string) => el + (SUBSCRIPT[n] ?? n));

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export function fiberLabel(fiber: boolean | null): string {
  if (fiber == null) return "fiber unknown";
  return fiber ? "on a fiber" : "free-floating";
}
