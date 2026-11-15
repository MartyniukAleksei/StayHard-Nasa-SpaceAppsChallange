// Pure helpers for the test cards: columns out of a time series, gaps, a straight-line fit.
export type Pt = [x: number, y: number];
type Rows = { columns: string[]; rows: (number | null)[][] };

/** (t, f(value)) pairs for one column; rows with a missing time or value are dropped, order is by time. */
export function column(s: Rows | null | undefined, name: string, f: (v: number) => number = (v) => v): Pt[] {
  if (!s) return [];
  const ti = s.columns.indexOf("t_s");
  const ci = s.columns.indexOf(name);
  if (ti < 0 || ci < 0) return [];
  const out: Pt[] = [];
  for (const r of s.rows) {
    const t = r[ti];
    const v = r[ci];
    if (t != null && v != null) out.push([t, f(v)]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/** Ranges between consecutive points that are further apart than minGap. Nothing is interpolated. */
export function findGaps(points: Pt[], minGap: number): [number, number][] {
  const gaps: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] - points[i - 1][0] > minGap) gaps.push([points[i - 1][0], points[i][0]]);
  }
  return gaps;
}

export type Fit = { slope: number; intercept: number; rms: number; n: number };

/** Least-squares line over the points whose x lies in [from, to]; null with fewer than 3 points. */
export function fitWindow(points: Pt[], from: number, to: number): Fit | null {
  const p = points.filter(([x]) => x >= from && x <= to);
  const n = p.length;
  if (n < 3) return null;
  const mx = p.reduce((a, q) => a + q[0], 0) / n;
  const my = p.reduce((a, q) => a + q[1], 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const [x, y] of p) {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const rms = Math.sqrt(p.reduce((a, [x, y]) => a + (y - (intercept + slope * x)) ** 2, 0) / n);
  return { slope, intercept, rms, n };
}
