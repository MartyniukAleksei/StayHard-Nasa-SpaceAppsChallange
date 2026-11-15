import type { EndType } from "@/shared/ui/EndMark";
import { EndGlyphIcon } from "./EndGlyph";
import type { Tone } from "./theme";

export type LegendItem = {
  id: string;
  label: string;
  /** dots = measured, line = model/data line, dashed = our estimate, or an end-type glyph */
  swatch: "dots" | "line" | "dashed" | "band" | { end: EndType };
  tone?: Tone;
  /** When set, the item is a toggle button (aria-pressed). */
  active?: boolean;
};

type Props = { items: LegendItem[]; onToggle?: (id: string) => void; label?: string; align?: "left" | "right" };

/** HTML legend under a chart. Labels never get clipped by the plot area. */
export function ChartLegend({ items, onToggle, label = "Legend", align = "left" }: Props) {
  return (
    <ul className={align === "right" ? "chart-legend right" : "chart-legend"} aria-label={label}>
      {items.map((it) => {
        const body = (
          <>
            <Swatch item={it} />
            <span>{it.label}</span>
          </>
        );
        return (
          <li key={it.id}>
            {onToggle ? (
              <button
                type="button"
                className={it.active === false ? "off" : undefined}
                aria-pressed={it.active !== false}
                onClick={() => onToggle(it.id)}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Swatch({ item }: { item: LegendItem }) {
  const s = item.swatch;
  if (typeof s === "object") return <EndGlyphIcon type={s.end} />;
  const tone = `tone-${item.tone ?? "ink"}`;
  return (
    <svg className={`legend-swatch ${tone}`} width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
      {s === "dots" && [4, 14].map((x) => <circle key={x} cx={x} cy={5} r={2.2} />)}
      {s === "line" && <polyline points="0,5 18,5" />}
      {s === "dashed" && <polyline className="dashed" points="0,5 18,5" />}
      {s === "band" && [0, 6, 12].map((x) => <line key={x} className="band-hatch" x1={x} y1={10} x2={x + 6} y2={0} />)}
    </svg>
  );
}
