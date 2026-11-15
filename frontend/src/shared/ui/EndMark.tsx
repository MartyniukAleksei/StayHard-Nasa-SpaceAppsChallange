// Test end type: colour + glyph, never colour alone (docs/design/README.md).

export type EndType = "Extinction" | "Completion" | "Disruption";

const MARK: Record<EndType, { glyph: string; cls: string; short: string }> = {
  Extinction: { glyph: "●", cls: "end-ext", short: "Ext" },
  Completion: { glyph: "○", cls: "end-com", short: "Com" },
  Disruption: { glyph: "◇", cls: "end-dis", short: "Dis" },
};

export const END_TYPES: EndType[] = ["Extinction", "Disruption", "Completion"];

export function EndMark({ type, count, short = false }: {
  type: EndType;
  count?: number;
  short?: boolean;
}) {
  const m = MARK[type];
  const label = short ? m.short : type;
  return (
    <span className={`end-mark ${m.cls}`} title={type}>
      <span aria-hidden="true">{m.glyph}</span> {count != null && <b>{count}</b>} {label}
    </span>
  );
}
