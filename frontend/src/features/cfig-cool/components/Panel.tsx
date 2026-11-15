import { useMemo, useState } from "react";
import { num, pct } from "@/shared/lib/format";
import { useWidth } from "@/shared/lib/useWidth";
import { ChartTooltip } from "@/shared/ui/chart/ChartTooltip";
import { niceTicks } from "@/shared/ui/chart/TimeChart";
import { layoutDots } from "../lib/layout";
import { type Filters, type View, coolKey, display, endKey, extent, fuelLabel, laneOf, matches, plotted, pressureLanes } from "../lib/regime";
import type { RegimeTest } from "../types";
import { Mark } from "./Marks";

const M = { l: 70, r: 14, t: 8, b: 38 };
const LANE_H = 34;
const PLOT_H = 250;
const R = 3;

type Props = {
  fuel: string;
  /** every test: the axes are shared by the three fuels so panels compare at a glance */
  all: RegimeTest[];
  view: View;
  filters: Filters;
  selected: string | null;
  onSelect: (id: string) => void;
};

/** One fuel's tests on the chosen axes. Matching tests are bright, filtered-out ones faint. */
export function Panel({ fuel, all, view, filters, selected, onSelect }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>(380, 220);
  const [hover, setHover] = useState<string | null>(null);
  const mine = useMemo(() => all.filter((t) => t.fuel === fuel), [all, fuel]);
  const { points, missing } = useMemo(() => plotted(mine, view), [mine, view]);
  const lanes = useMemo(() => (view.lanes ? pressureLanes(all) : []), [all, view]);
  const [x0, x1] = useMemo(() => extent(all, view.x.key), [all, view]);
  const [y0, y1] = useMemo(() => extent(all, view.y.key), [all, view]);
  const H = view.lanes ? M.t + lanes.length * LANE_H + M.b : M.t + PLOT_H + M.b;
  const padX = (x1 - x0) * 0.04 || 1;
  const padY = (y1 - y0) * 0.06 || 1;
  const sx = (v: number) => M.l + ((v - (x0 - padX)) / (x1 - x0 + 2 * padX)) * (W - M.l - M.r);
  const sy = (v: number) =>
    view.lanes
      ? M.t + (lanes.length - 1 - lanes.indexOf(laneOf(v)) + 0.5) * LANE_H
      : M.t + (1 - (v - (y0 - padY)) / (y1 - y0 + 2 * padY)) * PLOT_H;

  // cool-flame tests are placed first (they keep their true spot) and drawn last (on top)
  const dots = useMemo(() => {
    const ordered = [...points].sort((a, b) => Number(b.cool_flame === true) - Number(a.cool_flame === true));
    return layoutDots(
      ordered.map((t) => ({ id: t.test_id, x: sx(t[view.x.key] as number), y: sy(t[view.y.key] as number) })),
      { r: R * 1.2, gap: 0.6, maxDy: view.lanes ? LANE_H / 2 - R * 1.5 : 14, maxDx: 14 },
    );
  }, [points, view, W, lanes.length, x0, x1, y0, y1]);
  const byId = useMemo(() => new Map(mine.map((t) => [t.test_id, t])), [mine]);
  const hot = hover ? dots.find((d) => d.id === hover) : undefined;
  const hotTest = hover ? byId.get(hover) : undefined;
  const yTicks = view.lanes ? [] : niceTicks(y0 - padY, y1 + padY, 5);
  const xTicks = niceTicks(x0 - padX, x1 + padX, view.x.key === "x_o2" ? 6 : 5);

  return (
    <figure className="cf-panel">
      <figcaption className="cf-panel-title mono">
        {fuelLabel(fuel)} <span className="muted">· {points.length} plotted{missing ? `, ${missing} without a value` : ""}</span>
      </figcaption>
      <div ref={ref} className="cf-plot chart" onMouseLeave={() => setHover(null)}>
        <svg width={W} height={H} role="group" aria-label={`${fuelLabel(fuel)}: ${points.length} tests by ${view.x.label} and ${view.y.label}`}>
          {view.lanes
            ? lanes.map((p, i) => {
                const y = M.t + (lanes.length - 1 - i + 0.5) * LANE_H;
                return (
                  <g key={p}>
                    <line className="grid" x1={M.l} x2={W - M.r} y1={y} y2={y} />
                    <text x={M.l - 8} y={y + 4} textAnchor="end">
                      {p.toFixed(2)} bar
                    </text>
                  </g>
                );
              })
            : yTicks.map((v) => (
                <g key={v}>
                  <line className="grid" x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} />
                  <text x={M.l - 8} y={sy(v) + 4} textAnchor="end">
                    {display(view.y, v)}
                  </text>
                </g>
              ))}
          {xTicks.map((v) => (
            <text key={v} x={sx(v)} y={H - 20} textAnchor="middle">
              {display({ ...view.x, digits: view.x.key === "x_o2" ? 0 : view.x.digits }, v)}
            </text>
          ))}
          <text x={W - M.r} y={H - 4} textAnchor="end" className="axlabel">
            {view.x.label}, {view.x.unit}
          </text>
          {!view.lanes && (
            <text x={4} y={M.t + 4} className="axlabel">
              {view.y.label}, {view.y.unit}
            </text>
          )}
          {[...dots].reverse().map((d) => {
            const t = byId.get(d.id) as RegimeTest;
            const on = matches(t, filters);
            const cls = `${on ? "" : "off "}${selected === d.id ? "sel " : ""}${hover === d.id ? "hot" : ""}`.trim();
            return (
              <Mark
                key={d.id}
                t={t}
                cx={d.x}
                cy={d.y}
                r={R}
                className={cls}
                role="button"
                tabIndex={on ? 0 : -1}
                aria-label={`Test ${t.test_id}: ${fuelLabel(t.fuel)}, ${t.flame_type}, ${pct(t.x_o2)} XO₂, ${num(t.p_bar, 2, "bar")}, ${endKey(t)}`}
                aria-pressed={selected === d.id}
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
        {hot && hotTest && (
          <ChartTooltip id={`cf-tip-${fuel}`} x={hot.x} y={hot.y} width={W}>
            <Tip t={hotTest} />
          </ChartTooltip>
        )}
      </div>
    </figure>
  );
}

export const END_WORDS = { SE: "self-extinguished (SE)", FT: "flow terminated (FT)", none: "no ending recorded" } as const;

function Tip({ t }: { t: RegimeTest }) {
  return (
    <>
      <b>{t.test_id}</b>
      <dl>
        <dt>Flame</dt>
        <dd>{t.flame_type}</dd>
        <dt>XO₂</dt>
        <dd>
          {pct(t.x_o2)} → {pct(t.x_o2_after)}
        </dd>
        <dt>Burn time</dt>
        <dd>{num(t.burn_time_s, 0, "s")}</dd>
        <dt>Ending</dt>
        <dd>{END_WORDS[endKey(t)]}</dd>
        <dt>Peak burner T</dt>
        <dd>{num(t.peak_burner_t_c, 0, "°C")}</dd>
        <dt>Cool flame</dt>
        <dd>{coolKey(t) === "yes" ? "noted" : coolKey(t) === "no" ? "no" : "not recorded"}</dd>
      </dl>
      {t.comment && <span className="muted">{t.comment}</span>}
    </>
  );
}
