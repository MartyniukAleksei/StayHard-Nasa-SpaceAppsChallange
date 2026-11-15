import type { SVGProps } from "react";
import type { EndType } from "@/shared/ui/EndMark";
import { END_SHAPE, END_TONE, GLYPH_R } from "./theme";

type Props = Omit<SVGProps<SVGGElement>, "type"> & { type: EndType; cx: number; cy: number; r?: number };

/** SVG end-type marker for charts: ● Extinction, ○ Completion, ◇ Disruption (matches EndMark). */
export function EndGlyph({ type, cx, cy, r = GLYPH_R, className, ...rest }: Props) {
  const shape = END_SHAPE[type];
  const cls = `glyph glyph-${shape} tone-${END_TONE[type]}${className ? ` ${className}` : ""}`;
  return (
    <g className={cls} {...rest}>
      {shape === "diamond" ? (
        <polygon points={`${cx},${cy - r * 1.25} ${cx + r * 1.25},${cy} ${cx},${cy + r * 1.25} ${cx - r * 1.25},${cy}`} />
      ) : (
        <circle cx={cx} cy={cy} r={shape === "ring" ? r - 0.75 : r} />
      )}
    </g>
  );
}

/** Small inline SVG of the glyph, for legends and tables next to text. */
export function EndGlyphIcon({ type, size = 12 }: { type: EndType; size?: number }) {
  const h = size / 2;
  return (
    <svg className="glyph-icon" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <EndGlyph type={type} cx={h} cy={h} r={h * 0.7} />
    </svg>
  );
}
