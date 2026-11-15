import type { ReactNode } from "react";

const OFFSET = 12;
const WIDTH = 220;

/**
 * Tooltip for SVG charts. Place it inside a `position: relative` chart wrapper; x/y are
 * pixel coordinates of the hovered mark inside that wrapper. Flips to the left near the edge.
 */
export function ChartTooltip({ id, x, y, width, children }: {
  id: string;
  x: number;
  y: number;
  /** wrapper width, to keep the tooltip inside it */
  width: number;
  children: ReactNode;
}) {
  const left = x + OFFSET + WIDTH > width ? Math.max(0, x - OFFSET - WIDTH) : x + OFFSET;
  return (
    <div id={id} role="tooltip" className="chart-tip" style={{ left, top: Math.max(0, y - 8), width: WIDTH }}>
      {children}
    </div>
  );
}
