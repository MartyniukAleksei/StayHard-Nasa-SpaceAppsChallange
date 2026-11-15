import { useMemo, useState } from "react";
import type { TestSummary } from "@/features/flex-tests";
import { useWidth } from "@/shared/lib/useWidth";
import { chem, fiberLabel, num, pct } from "@/shared/lib/format";
import { ChartLegend } from "@/shared/ui/chart/ChartLegend";
import { ChartTooltip } from "@/shared/ui/chart/ChartTooltip";
import { EndGlyph } from "@/shared/ui/chart/EndGlyph";
import { GLYPH_R } from "@/shared/ui/chart/theme";
import { niceTicks } from "@/shared/ui/chart/TimeChart";
import { END_TYPES, EndMark, type EndType } from "@/shared/ui/EndMark";
import { endShown, pressureBand, toggleEnd, type Filters } from "../lib/filter";
import { layoutDots } from "../lib/layout";
import { MapControls } from "./MapControls";

// D: all tests on one map. X = O₂, rows = diluent × pressure band. Matching tests are bright,
// the rest faint; the glyph (● ○ ◇) and its colour = how the test ended.

const ROWS: { diluent: string; band: string; label: string }[] = [
  { diluent: "N2", band: "0.7", label: "N₂ · 0.7 atm" },
  { diluent: "N2", band: "1", label: "N₂ · 1 atm" },
  { diluent: "N2", band: "2-3", label: "N₂ · 2–3 atm" },
  { diluent: "CO2", band: "0.7", label: "CO₂ · 0.7 atm" },
  { diluent: "CO2", band: "1", label: "CO₂ · 1 atm" },
  { diluent: "He", band: "0.7", label: "He · 0.7 atm" },
  { diluent: "He", band: "1", label: "He · 1 atm" },
];
const ROW_H = 36;
/** Narrow screens: smaller glyphs and taller rows (5 lanes) so 270 tests still fit side by side. */
const COMPACT_W = 600;
const COMPACT_ROW_H = 46;
const COMPACT_R = 2.6;
const M = { l: 104, r: 16, t: 6, b: 30 };
const X0 = 0.1;
const X1 = 0.36;
const GAP = 1;
const TIP_ID = "ex-map-tip";

const xScale = (x: number, W: number) => M.l + ((x - X0) / (X1 - X0)) * (W - M.l - M.r);
const rowY = (i: number, rowH: number) => M.t + (i + 0.5) * rowH;

type Props = {
  tests: TestSummary[];
  filters: Filters;
  onFilters: (f: Filters) => void;
  matching: Set<number>;
  selected: number | null;
  onSelect: (id: number) => void;
};

export function TestMap({ tests, filters, onFilters, matching, selected, onSelect }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>(700, 300);
  const [hover, setHover] = useState<number | null>(null);
  const rows = useMemo(
    () => ROWS.filter((r) => tests.some((t) => t.diluent === r.diluent && pressureBand(t.p_atm) === r.band)),
    [tests],
  );
  const compact = W < COMPACT_W;
  const rowH = compact ? COMPACT_ROW_H : ROW_H;
  const r = compact ? COMPACT_R : GLYPH_R;
  const H = M.t + rows.length * rowH + M.b;
  const sx = (x: number) => xScale(x, W);

  const byId = useMemo(() => new Map(tests.map((t) => [t.test_no, t])), [tests]);
  const dots = useMemo(() => {
    const input = tests.flatMap((t) => {
      const i = rows.findIndex((r) => r.diluent === t.diluent && r.band === pressureBand(t.p_atm));
      return i < 0 || t.x_o2 == null ? [] : [{ id: t.test_no, x: xScale(t.x_o2, W), y: rowY(i, rowH) }];
    });
    // the diamond (◇) reaches 1.25 r, so lay out by the widest glyph
    return layoutDots(input, { r: r * 1.25, gap: GAP, half: rowH / 2, xMin: M.l, xMax: W - M.r });
  }, [tests, rows, W, rowH, r]);

  const hovered = hover != null ? dots.find((d) => d.id === hover) : undefined;
  const hoveredTest = hover != null ? byId.get(hover) : undefined;

  return (
    <div className="ex-mapbox">
      <MapControls filters={filters} onChange={onFilters} />
      <div ref={ref} className="ex-map chart" onMouseLeave={() => setHover(null)}>
        <svg
          width={W}
          height={H}
          role="group"
          aria-label={`Map of ${tests.length} tests by oxygen, diluent and pressure; ${matching.size} match the filters`}
        >
          {rows.map((r, i) => (
            <g key={r.label}>
              <line className="grid" x1={M.l} x2={W - M.r} y1={rowY(i, rowH)} y2={rowY(i, rowH)} />
              <text x={M.l - 8} y={rowY(i, rowH) + 4} textAnchor="end">
                {r.label}
              </text>
            </g>
          ))}
          {niceTicks(X0, X1).map((x) => (
            <text key={x} x={sx(x)} y={H - 10} textAnchor="middle">
              {Math.round(x * 100)}%
            </text>
          ))}
          <text x={W - M.r} y={H - 10} textAnchor="end" className="axlabel">
            O₂
          </text>
          {dots.map((d) => {
            const t = byId.get(d.id)!;
            const on = matching.has(d.id);
            const cls = `ex-dot${on ? "" : " off"}${selected === d.id ? " sel" : ""}${hover === d.id ? " hot" : ""}`;
            return (
              <EndGlyph
                key={d.id}
                type={t.end_type}
                cx={d.x}
                cy={d.y}
                r={r}
                className={cls}
                role="button"
                tabIndex={on ? 0 : -1}
                aria-label={`Test ${d.id}: ${t.fuel}, ${pct(t.x_o2)} O₂, ${t.end_type}`}
                aria-describedby={hover === d.id ? TIP_ID : undefined}
                onMouseEnter={() => setHover(d.id)}
                onFocus={() => setHover(d.id)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect(d.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(d.id);
                  }
                }}
              />
            );
          })}
        </svg>
        {hovered && hoveredTest && (
          <ChartTooltip id={TIP_ID} x={hovered.x} y={hovered.y} width={W}>
            <Tip t={hoveredTest} />
          </ChartTooltip>
        )}
      </div>
      <ChartLegend
        label="Outcome: click to show or hide"
        onToggle={(id) => onFilters(toggleEnd(filters, id))}
        items={END_TYPES.map((e: EndType) => ({ id: e, label: e, swatch: { end: e }, active: endShown(filters, e) }))}
      />
      <p className="ex-legend mono small">faint = filtered out · click a point to preview</p>
    </div>
  );
}

function Tip({ t }: { t: TestSummary }) {
  return (
    <>
      <b>
        #{t.test_no} · {t.fuel}
      </b>
      <dl>
        <dt>Diluent</dt>
        <dd>{chem(t.diluent)}</dd>
        <dt>O₂</dt>
        <dd>{pct(t.x_o2)}</dd>
        <dt>Pressure</dt>
        <dd>{num(t.p_atm, 2, "atm")}</dd>
        <dt>Initial d₀</dt>
        <dd>{num(t.d0_mm, 2, "mm")}</dd>
        <dt>Outcome</dt>
        <dd>
          <EndMark type={t.end_type} />
        </dd>
        <dt>Droplet</dt>
        <dd>{fiberLabel(t.fiber)}</dd>
      </dl>
      {t.has_3d && <span className="muted">3D replay available</span>}
    </>
  );
}
