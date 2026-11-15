import { useQueries } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { particlesFirst, PTRAK_LIMIT, sameRSeriesQuery, sameRTestQuery, type TimeSeries } from "@/features/same-r-3d";
import { TimeChart } from "@/shared/ui/chart/TimeChart";
import { apiUrl, useSameRTests, useTem } from "../api";
import { compareHref, MAX_COMPARE, parseIds, testHref, TESTS_PATH } from "../lib/compare";
import { column } from "../lib/tests";
import type { PageDetail } from "../types";
import "./same-r.css";

const cell = (v: number | string | null | undefined, unit = "") =>
  v == null ? "—" : typeof v === "number" ? `${v}${unit}` : v;

/** Up to three SAME-R tests side by side; charts share axes so the amount of smoke reads directly. */
export function SameRCompare() {
  const [sp, setSp] = useSearchParams();
  const ids = parseIds(sp.get("ids"));
  const setIds = (next: number[]) => setSp(new URLSearchParams(compareHref(next).split("?")[1] ?? ""), { replace: true });
  const details = useQueries({ queries: ids.map(sameRTestQuery) });
  const series = useQueries({ queries: ids.map(sameRSeriesQuery) });

  const loaded = series.map((q) => q.data).filter((s): s is TimeSeries => Boolean(s));
  const max = (col: string) => Math.max(1e-9, ...loaded.flatMap((s) => column(s, col).map((p) => p[1])));
  const tMin = Math.min(0, ...loaded.flatMap((s) => column(s, "t_s").map((p) => p[0])));
  const tMax = Math.max(1, ...loaded.flatMap((s) => column(s, "t_s").map((p) => p[0])));
  const domain = {
    x: [tMin, tMax] as [number, number],
    ptrak: [0, max("ptrak_per_cc") * 1.05] as [number, number],
    mass: [0, max("dusttrak_b_mg_m3") * 1.05] as [number, number],
  };

  return (
    <div className="wrap band sr-cmp">
      <h1 className="h-display">Compare tests</h1>
      <p className="lede">Up to {MAX_COMPARE} tests side by side. Charts share the same axes.</p>
      <AddTest ids={ids} onAdd={(id) => setIds([...ids, id])} />
      {ids.length === 0 ? (
        <p className="placeholder">
          No tests selected. Tick up to {MAX_COMPARE} tests in <Link to={TESTS_PATH}>Tests</Link>, or add a test number
          above.
        </p>
      ) : (
        <div className="sr-cmp-cols">
          {ids.map((id, i) => (
            <Column
              key={id}
              id={id}
              detail={details[i]?.data as PageDetail | null | undefined}
              series={series[i]?.data}
              pending={details[i]?.isPending ?? true}
              domain={domain}
              onRemove={() => setIds(ids.filter((x) => x !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddTest({ ids, onAdd }: { ids: number[]; onAdd: (id: number) => void }) {
  const { data } = useSameRTests();
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");
  const full = ids.length >= MAX_COMPARE;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = Number.parseInt(value, 10);
    if (!data?.tests.some((t) => t.test_no === id)) return setMsg(`There is no test #${value} in SAME-R.`);
    if (ids.includes(id)) return setMsg(`Test #${id} is already here.`);
    setMsg("");
    setValue("");
    onAdd(id);
  };
  return (
    <form className="sr-cmp-add" onSubmit={submit}>
      <label className="field">
        <span>Add test №</span>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          disabled={full}
          placeholder={full ? `Maximum ${MAX_COMPARE} tests` : "e.g. 73"}
        />
      </label>
      <button type="submit" className="btn" disabled={full || !value}>
        Add
      </button>
      {msg && (
        <span className="muted small" role="status">
          {msg}
        </span>
      )}
    </form>
  );
}

type ColumnProps = {
  id: number;
  detail: PageDetail | null | undefined;
  series: TimeSeries | null | undefined;
  pending: boolean;
  domain: { x: [number, number]; ptrak: [number, number]; mass: [number, number] };
  onRemove: () => void;
};

function Column({ id, detail: t, series: s, pending, domain, onRemove }: ColumnProps) {
  if (pending) return <article className="sr-cmp-col muted mono">Loading #{id}…</article>;
  const remove = (
    <button type="button" className="btn ghost" onClick={onRemove} aria-label={`Remove test ${id}`}>
      Remove
    </button>
  );
  if (!t) {
    return (
      <article className="sr-cmp-col">
        <p className="placeholder">There is no test #{id} in SAME-R.</p>
        {remove}
      </article>
    );
  }
  const main = t.rows.find((r) => r.test_id === String(id)) ?? t.rows[0];
  const aged = t.rows.find((r) => r.test_id === `${id}a`);
  const peak = t.coverage?.ptrak_peak_per_cc;
  const mass = s ? column(s, "dusttrak_b_mg_m3") : [];
  return (
    <article className="sr-cmp-col" aria-labelledby={`sr-cmp-${id}`}>
      <header className="sr-cmp-head">
        <h2 id={`sr-cmp-${id}`} className="h-section">
          <Link to={testHref(id)}>#{main.test_id}</Link>
        </h2>
        {remove}
      </header>
      <p className="mono small">
        {cell(main.material)} · {cell(main.description)}
      </p>
      <TemThumb testNo={id} has={t.tem_archives.length > 0} />
      <dl className="sr-cmp-kv">
        <dt>Heater Rt/R0</dt>
        <dd>{cell(main.heater_rt_r0)}</dd>
        <dt>Heating</dt>
        <dd>{cell(main.heating_s, " s")}</dd>
        <dt>Peak particles</dt>
        <dd>
          {peak == null ? "—" : `${peak >= PTRAK_LIMIT ? "≥ " : ""}${Math.round(peak).toLocaleString("en-US")} /cm³`}
        </dd>
        <dt>Aged row</dt>
        <dd>{aged ? `${aged.test_id} · ${cell(aged.net_aging_s, " s")}` : "—"}</dd>
      </dl>
      {s ? (
        <>
          <TimeChart
            series={[{ id: "p", label: "P-Trak", points: column(s, "ptrak_per_cc"), kind: "line", tone: "s2" }]}
            xLabel="time, s"
            yLabel="particles / cm³"
            height={170}
            xDomain={domain.x}
            yDomain={domain.ptrak}
            ariaLabel={`Particle count over time, test ${id}`}
            markers={[{ x: 0, label: "heater on" }]}
          />
          {mass.length > 0 ? (
            <TimeChart
              series={[{ id: "m", label: "DustTrak B", points: mass, kind: "line" }]}
              xLabel="time, s"
              yLabel="mg/m³"
              height={170}
              xDomain={domain.x}
              yDomain={domain.mass}
              ariaLabel={`Smoke mass over time, test ${id}`}
            />
          ) : (
            <p className="muted small">No valid DustTrak B readings.</p>
          )}
        </>
      ) : (
        <p className="muted small">No telemetry for this test.</p>
      )}
    </article>
  );
}

/** One real particle image per test (the first zoomed TEM image), from NASA PSI. */
function TemThumb({ testNo, has }: { testNo: number; has: boolean }) {
  const { data } = useTem(testNo, has);
  if (!has) return <p className="muted small">No TEM images for this test.</p>;
  const a = data?.archives[0];
  const im = a ? particlesFirst(a.images)[0] : undefined;
  if (!im) return <div className="sr-cmp-tem placeholder small">Loading particle image…</div>;
  return (
    <a className="sr-cmp-tem" href={apiUrl(im.url)} target="_blank" rel="noreferrer">
      <img src={apiUrl(`${im.url}?max_side=480`)} alt={`TEM image of smoke particles, test ${testNo}`} loading="lazy" />
    </a>
  );
}
