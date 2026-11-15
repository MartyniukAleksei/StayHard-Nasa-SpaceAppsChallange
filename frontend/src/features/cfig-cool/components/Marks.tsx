import type { SVGProps } from "react";
import { endKey } from "../lib/regime";
import type { RegimeTest } from "../types";

type Props = Omit<SVGProps<SVGGElement>, "r"> & { t: RegimeTest; cx: number; cy: number; r: number };

/**
 * One test on the map. Fill says how the run ended (● self-extinguished, ○ flow terminated, × neither),
 * shape says the flame type (circle normal, square inverse), blue and larger = a cool flame is noted.
 * Colour never carries meaning alone.
 */
export function Mark({ t, cx, cy, r, className, ...rest }: Props) {
  const end = endKey(t);
  const cool = t.cool_flame === true;
  const rr = cool ? r * 1.5 : r;
  const cls = `cf-mk e-${end}${cool ? " cool" : ""}${className ? ` ${className}` : ""}`;
  return (
    <g className={cls} {...rest}>
      <circle className="cf-hit" cx={cx} cy={cy} r={Math.max(9, rr + 4)} />
      {end === "none" ? (
        <path d={`M${cx - rr},${cy - rr}L${cx + rr},${cy + rr}M${cx - rr},${cy + rr}L${cx + rr},${cy - rr}`} />
      ) : t.flame_type === "inverse" ? (
        <rect x={cx - rr * 0.9} y={cy - rr * 0.9} width={rr * 1.8} height={rr * 1.8} />
      ) : (
        <circle cx={cx} cy={cy} r={rr} />
      )}
    </g>
  );
}

/** Legend swatch for the same shapes. */
export function MarkIcon({ end, shape, cool = false }: { end: "SE" | "FT" | "none"; shape: "circle" | "square"; cool?: boolean }) {
  const dummy = { flame_type: shape === "square" ? "inverse" : "normal", end_mode: end === "SE" ? "self_extinguished" : end === "FT" ? "flow_terminated" : null, cool_flame: cool } as RegimeTest;
  return (
    <svg className="legend-swatch" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <Mark t={dummy} cx={8} cy={8} r={4} />
    </svg>
  );
}
