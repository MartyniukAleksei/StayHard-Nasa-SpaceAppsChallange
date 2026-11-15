import { useState } from "react";
import { MAX_COMPARE, type TestSummary } from "@/features/flex-tests";
import { chem, num, pct } from "@/shared/lib/format";
import { EndMark } from "@/shared/ui/EndMark";

type SortKey = "test_no" | "fuel" | "p_atm" | "x_o2" | "diluent" | "d0_mm" | "k_mm2_s" | "burn_time_s" | "end_type";

const COLS: { key: SortKey; label: string; hideMobile?: boolean }[] = [
  { key: "test_no", label: "#" },
  { key: "fuel", label: "Fuel" },
  { key: "p_atm", label: "p, atm", hideMobile: true },
  { key: "x_o2", label: "O₂" },
  { key: "diluent", label: "Diluent", hideMobile: true },
  { key: "d0_mm", label: "d₀, mm", hideMobile: true },
  { key: "k_mm2_s", label: "K, mm²/s", hideMobile: true },
  { key: "burn_time_s", label: "Burn, s", hideMobile: true },
  { key: "end_type", label: "End" },
];

function compare(a: TestSummary, b: TestSummary, key: SortKey): number {
  const x = a[key];
  const y = b[key];
  if (x == null) return 1;
  if (y == null) return -1;
  return x < y ? -1 : x > y ? 1 : 0;
}

type Props = {
  rows: TestSummary[];
  selected: number | null;
  onSelect: (id: number) => void;
  compareIds: number[];
  onToggleCompare: (id: number) => void;
};

export function TestTable({ rows, selected, onSelect, compareIds, onToggleCompare }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "test_no", dir: 1 });
  const sorted = [...rows].sort((a, b) => compare(a, b, sort.key) * sort.dir);
  const full = compareIds.length >= MAX_COMPARE;

  return (
    <div className="ex-table-wrap">
      <table className="ex-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Compare</span>
            </th>
            {COLS.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={c.hideMobile ? "hide-m" : undefined}
                aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((-s.dir) as 1 | -1) : 1 }))}
                >
                  {c.label}
                  {sort.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const inCmp = compareIds.includes(t.test_no);
            return (
              <tr
                key={t.test_no}
                className={selected === t.test_no ? "sel" : undefined}
                onClick={() => onSelect(t.test_no)}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={inCmp}
                    disabled={full && !inCmp}
                    onChange={() => onToggleCompare(t.test_no)}
                    aria-label={`Add test ${t.test_no} to comparison`}
                  />
                </td>
                <td>
                  <button type="button" className="ex-rowbtn" onClick={() => onSelect(t.test_no)}>
                    {t.test_no}
                  </button>
                </td>
                <td>{t.fuel}</td>
                <td className="hide-m">{num(t.p_atm, 2)}</td>
                <td>{pct(t.x_o2)}</td>
                <td className="hide-m">{chem(t.diluent)}</td>
                <td className="hide-m">{num(t.d0_mm, 2)}</td>
                <td className="hide-m">{num(t.k_mm2_s, 2)}</td>
                <td className="hide-m">{num(t.burn_time_s, 1)}</td>
                <td>
                  <EndMark type={t.end_type} short />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="placeholder">No tests match these filters.</p>}
    </div>
  );
}
