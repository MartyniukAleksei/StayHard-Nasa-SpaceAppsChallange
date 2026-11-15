// One mark per material: 4 shapes, then the same 4 hollow. Colour is left to the parent (currentColor).
// shortcut: 8 distinct marks, more materials than that repeat from the start.
export const MARK_COUNT = 8;

/** Colour of mark i (tokens --cat-1…5); the shape still tells materials apart without it. */
export const markColor = (i: number) => `var(--cat-${(i % 5) + 1})`;

export function Shape({ i }: { i: number }) {
  const hollow = Math.floor(i / 4) % 2 === 1;
  const p = hollow ? { fill: "none", stroke: "currentColor", strokeWidth: 1.5 } : { fill: "currentColor" };
  switch (i % 4) {
    case 0:
      return <circle r={4.5} {...p} />;
    case 1:
      return <rect x={-4} y={-4} width={8} height={8} {...p} />;
    case 2:
      return <path d="M0-5.5L5.5 4.5H-5.5Z" {...p} />;
    default:
      return <path d="M0-6L6 0L0 6L-6 0Z" {...p} />;
  }
}

/** Inline mark for legends and filter tags. */
export function Mark({ i }: { i: number }) {
  return (
    <svg className="sr-mark" width={14} height={14} viewBox="-7 -7 14 14" aria-hidden="true" style={{ color: markColor(i) }}>
      <Shape i={i} />
    </svg>
  );
}
