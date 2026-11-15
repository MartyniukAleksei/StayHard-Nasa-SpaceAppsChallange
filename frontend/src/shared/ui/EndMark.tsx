// Test end type: colour + glyph, never colour alone (docs/design/README.md). Always the full name.

export type EndType = "Extinction" | "Completion" | "Disruption";

const MARK: Record<EndType, { glyph: string; cls: string }> = {
  Extinction: { glyph: "●", cls: "end-ext" },
  Completion: { glyph: "○", cls: "end-com" },
  Disruption: { glyph: "◇", cls: "end-dis" },
};

export const END_TYPES: EndType[] = ["Extinction", "Disruption", "Completion"];

export function EndMark({ type, count }: { type: EndType; count?: number }) {
  const m = MARK[type];
  return (
    <span className={`end-mark ${m.cls}`} title={type}>
      <span aria-hidden="true">{m.glyph}</span> {count != null && <b>{count}</b>} {type}
    </span>
  );
}
