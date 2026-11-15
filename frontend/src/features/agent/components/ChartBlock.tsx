import { compareHref, testHref } from "@/features/flex-tests";
import { useOverview } from "@/features/study-overview";
import { TimeChart } from "@/shared/ui/chart/TimeChart";
import { EndMark, type EndType } from "@/shared/ui/EndMark";
import { Link } from "react-router";
import { chartCsv, csvName } from "../lib/csv";
import type { Chart } from "../types";

/** Графік, який побудував агент: дані з бекенду, малюємо тим самим TimeChart, що й сторінки. */
export function ChartBlock({ chart }: { chart: Chart }) {
  const flexDoi = useOverview().data?.about.doi;
  const doi = chart.doi ?? flexDoi;
  const href = chartHref(chart);
  const download = () => {
    const url = URL.createObjectURL(new Blob([chartCsv(chart, doi)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: csvName(chart) });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <figure className="ag-chart">
      <figcaption className="ag-chart-cap">
        <span className="mono small">{chart.title}</span>
        {chart.derived && <span className="tag ag-tag" title="Computed from measured values">derived</span>}
      </figcaption>
      <TimeChart
        // scatter series are end types: their legend (EndMark + counts) is drawn below, not by TimeChart
        series={chart.series.map(({ id, label, points, kind, tone }) => ({
          id,
          label: chart.kind === "scatter" ? undefined : label,
          points,
          kind,
          tone,
        }))}
        xLabel={chart.x_label}
        yLabel={chart.y_label}
        height={200}
        ariaLabel={chart.title}
      />
      {chart.kind === "scatter" && (
        <p className="small ag-legend">
          {chart.series.map((s) => (
            <EndMark key={s.id} type={s.id as EndType} count={s.points.length} />
          ))}
        </p>
      )}
      {chart.notes.map((n) => (
        <p key={n} className="muted small">{n}</p>
      ))}
      <div className="ag-chart-actions">
        {href && (
          <Link className="btn ghost" to={href}>
            Open on page
          </Link>
        )}
        <button type="button" className="btn ghost" onClick={download}>
          Download CSV
        </button>
      </div>
    </figure>
  );
}

/** "Open on page": FLEX test / compare, or the same pages of SAME-R for its charts. */
function chartHref(chart: Chart): string | null {
  if (chart.study === "samer") {
    const ids = chart.test_ids ?? [];
    if (ids.length === 1) return `/studies/same-r/tests/${ids[0]}`;
    return ids.length >= 2 ? `/studies/same-r/compare?ids=${ids.slice(0, 3).join(",")}` : null;
  }
  const nos = chart.test_nos;
  return nos.length === 1 ? testHref(nos[0]) : nos.length >= 2 ? compareHref(nos) : null;
}
