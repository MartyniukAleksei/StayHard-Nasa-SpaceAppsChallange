import { useWidth } from "@/shared/lib/useWidth";
import { niceTicks } from "@/shared/ui/chart/TimeChart";
import type { TestSummary } from "@/features/flex-tests";
import { pressureBand } from "../lib/filter";

// D: all 274 tests on one map. X = O₂, rows = diluent × pressure band.
// Matching tests are bright, the rest faint; colour + square = how it ended.

const ROWS: { diluent: string; band: string; label: string }[] = [
  { diluent: "N2", band: "0.7", label: "N₂ · 0.7 atm" },
  { diluent: "N2", band: "1", label: "N₂ · 1 atm" },
  { diluent: "N2", band: "2-3", label: "N₂ · 2–3 atm" },
  { diluent: "CO2", band: "0.7", label: "CO₂ · 0.7 atm" },
  { diluent: "CO2", band: "1", label: "CO₂ · 1 atm" },
  { diluent: "He", band: "0.7", label: "He · 0.7 atm" },
  { diluent: "He", band: "1", label: "He · 1 atm" },
];
const ROW_H = 26;
const M = { l: 104, r: 12, t: 8, b: 30 };
const X0 = 0.1;
const X1 = 0.36;
const DOT = 6;
const END_CLASS = { Extinction: "end-ext", Disruption: "end-dis", Completion: "end-com" } as const;

const jitter = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s) - 0.5;
};

type Props = {
  tests: TestSummary[];
  matching: Set<number>;
  selected: number | null;
  onSelect: (id: number) => void;
};

export function TestMap({ tests, matching, selected, onSelect }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>(700, 300);
  const rows = ROWS.filter((r) => tests.some((t) => t.diluent === r.diluent && pressureBand(t.p_atm) === r.band));
  const H = M.t + rows.length * ROW_H + M.b;
  const sx = (x: number) => M.l + ((x - X0) / (X1 - X0)) * (W - M.l - M.r);
  const rowIndex = (t: TestSummary) =>
    rows.findIndex((r) => r.diluent === t.diluent && r.band === pressureBand(t.p_atm));

  return (
    <div ref={ref} className="ex-map">
      <svg
        width={W}
        height={H}
        role="img"
        aria-label={`Map of ${tests.length} tests by oxygen, diluent and pressure; ${matching.size} match the filters`}
      >
        {rows.map((r, i) => (
          <g key={r.label}>
            <line className="ex-map-row" x1={M.l} x2={W - M.r} y1={M.t + (i + 0.5) * ROW_H} y2={M.t + (i + 0.5) * ROW_H} />
            <text x={M.l - 8} y={M.t + (i + 0.5) * ROW_H + 4} textAnchor="end">
              {r.label}
            </text>
          </g>
        ))}
        {niceTicks(X0, X1).map((x) => (
          <text key={x} x={sx(x)} y={H - 10} textAnchor="middle">
            {Math.round(x * 100)}%
          </text>
        ))}
        <text x={W - M.r} y={H - 10} textAnchor="end" className="ex-map-ax">
          O₂
        </text>
        {tests.map((t) => {
          const i = rowIndex(t);
          if (i < 0 || t.x_o2 == null) return null;
          const x = sx(t.x_o2) + jitter(t.test_no + 7) * 3;
          const y = M.t + (i + 0.5) * ROW_H + jitter(t.test_no) * (ROW_H - DOT - 4);
          const on = matching.has(t.test_no);
          return (
            <rect
              key={t.test_no}
              className={`${END_CLASS[t.end_type]} ex-dot${on ? "" : " off"}${selected === t.test_no ? " sel" : ""}`}
              x={x - DOT / 2}
              y={y - DOT / 2}
              width={DOT}
              height={DOT}
              onClick={() => onSelect(t.test_no)}
            >
              <title>
                #{t.test_no} · {t.fuel} · {t.end_type}
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
