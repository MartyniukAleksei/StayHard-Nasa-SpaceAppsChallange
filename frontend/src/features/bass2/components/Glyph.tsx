import { outcomeStyle } from "../lib/outcomes";

const R = 4;

/** SVG glyph of a test outcome, centred at 0,0. Same shapes as the legend and the table. */
export function Glyph({ outcome }: { outcome: string | null | undefined }) {
  const s = outcomeStyle(outcome);
  const cls = `b2-g b2-${s.tone}`;
  switch (s.shape) {
    case "dot":
      return <circle r={R} className={`${cls} fill`} />;
    case "ring":
      return <circle r={R - 0.5} className={cls} />;
    case "ringdot":
      return (
        <>
          <circle r={R - 0.5} className={cls} />
          <circle r={1.4} className={`${cls} fill`} />
        </>
      );
    case "diamond":
      return <path d={`M0 ${-R - 1}L${R + 1} 0L0 ${R + 1}L${-R - 1} 0Z`} className={cls} />;
    case "square":
      return <rect x={-R + 0.5} y={-R + 0.5} width={2 * R - 1} height={2 * R - 1} className={`${cls} fill`} />;
    case "cross":
      return <path d={`M${-R} ${-R}L${R} ${R}M${R} ${-R}L${-R} ${R}`} className={cls} />;
    default:
      return <path d={`M${-R} 0H${R}`} className={cls} />;
  }
}

/** Inline text glyph + short label, for tables and lists. */
export function OutcomeMark({ outcome, long = false }: { outcome: string | null | undefined; long?: boolean }) {
  const s = outcomeStyle(outcome);
  return (
    <span className={`b2-mark b2-${s.tone}`}>
      <span aria-hidden="true">{s.glyph}</span> {long ? s.label : s.short}
    </span>
  );
}
