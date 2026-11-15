// Дані графіка агента → CSV. Перший рядок — джерело й DOI (дані CC0, але DOI цитуємо).
import type { Chart } from "../types.ts";

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function chartCsv(chart: Chart, doi?: string): string {
  const study = chart.study === "samer" ? "SAME-R (PSI-101)" : "FLEX (PSI-69)";
  const head = `# ${chart.title}. Data: NASA PSI ${study}${doi ? `, doi:${doi}` : ""}${chart.derived ? ". Derived from measured values" : ""}`;
  const lines = [head, ["series", chart.x_label, chart.y_label].map(esc).join(",")];
  for (const s of chart.series) for (const [x, y] of s.points) lines.push([esc(s.label), x, y].join(","));
  return `${lines.join("\n")}\n`;
}

export const csvName = (chart: Chart) =>
  `${chart.title.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "chart"}.csv`;
