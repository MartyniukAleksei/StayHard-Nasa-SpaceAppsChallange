import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import {
  compareHref,
  MAX_COMPARE,
  parseIds,
  testHref,
  useTests,
  useTestsDetail,
  type TestDetail,
} from "@/features/flex-tests";
import { useReplays, type Replay } from "@/features/replay";
import { MediaBlock } from "@/features/test-page";
import { chem, fiberLabel, num, pct } from "@/shared/lib/format";
import { TimeChart } from "@/shared/ui/chart/TimeChart";
import { EndMark } from "@/shared/ui/EndMark";
import { Placeholder } from "@/shared/ui/Placeholder";
import "./compare.css";

const EXCERPT = 220;

/** 4A: up to three tests side by side, one column each, on shared chart axes. */
export function Compare() {
  const [sp, setSp] = useSearchParams();
  const ids = parseIds(sp.get("ids"));
  const details = useTestsDetail(ids);
  const replays = useReplays(ids);
  const setIds = (next: number[]) => setSp(new URLSearchParams(compareHref(next).split("?")[1] ?? ""), { replace: true });

  const loaded = details.map((q) => q.data).filter((d): d is TestDetail => Boolean(d));
  const series = replays.map((q) => q.data).filter((r): r is Replay => Boolean(r));
  const tMax = Math.max(1, ...series.flatMap((r) => r.droplet.map((p) => p[0])));
  const d2Max = Math.max(1, ...series.flatMap((r) => r.droplet.map((p) => p[1] * p[1]))) * 1.05;
  const fiberClasses = new Set(loaded.map((t) => fiberLabel(t.fiber)));

  return (
    <div className="wrap cmp">
      <header className="cmp-head">
        <h1 className="h-display">Compare tests</h1>
        <p className="lede">
          Up to {MAX_COMPARE} tests side by side. Charts share the same axes, so slopes and sizes can be read directly.
        </p>
        <AddTest ids={ids} onAdd={(id) => setIds([...ids, id])} />
      </header>
      {ids.length === 0 ? (
        <p className="placeholder">
          No tests selected. Tick up to three tests in the <Link to="/studies/flex/tests">Test explorer</Link>, or add a
          test number above.
        </p>
      ) : (
        <>
          {fiberClasses.size > 1 && (
            <p className="cmp-warn" role="note">
              These tests mix droplet classes ({[...fiberClasses].join(", ")}). Fiber-supported and free-floating droplets
              are not directly comparable.
            </p>
          )}
          <section aria-labelledby="cmp-diff">
            <h2 id="cmp-diff" className="h-section">How they differ</h2>
            <Placeholder>a sourced, data-derived explanation of the differences between these tests.</Placeholder>
          </section>
          <div className="cmp-cols" style={{ "--n": ids.length } as React.CSSProperties}>
            {ids.map((id, i) => (
              <Column
                key={id}
                id={id}
                detail={details[i]?.data}
                replay={replays[i]?.data}
                error={details[i]?.isError ?? false}
                domain={{ x: [0, tMax], y: [0, d2Max] }}
                onRemove={() => setIds(ids.filter((x) => x !== id))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AddTest({ ids, onAdd }: { ids: number[]; onAdd: (id: number) => void }) {
  const { data: tests } = useTests();
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");
  const full = ids.length >= MAX_COMPARE;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = Number.parseInt(value, 10);
    if (!tests?.some((t) => t.test_no === id)) return setMsg(`There is no test #${value} in FLEX.`);
    if (ids.includes(id)) return setMsg(`Test #${id} is already here.`);
    setMsg("");
    setValue("");
    onAdd(id);
  };

  return (
    <form className="cmp-add" onSubmit={submit}>
      <label className="field">
        <span>Add test №</span>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          disabled={full}
          placeholder={full ? `Maximum ${MAX_COMPARE} tests` : "e.g. 207"}
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
  detail?: TestDetail;
  replay?: Replay;
  error: boolean;
  domain: { x: [number, number]; y: [number, number] };
  onRemove: () => void;
};

function Column({ id, detail: t, replay, error, domain, onRemove }: ColumnProps) {
  if (error) {
    return (
      <article className="cmp-col">
        <p className="placeholder">Test #{id} could not be loaded.</p>
        <button type="button" className="btn ghost" onClick={onRemove}>
          Remove
        </button>
      </article>
    );
  }
  if (!t) return <article className="cmp-col muted mono">Loading #{id}…</article>;
  const d2 = (replay?.droplet ?? []).map(([s, d]) => [s, d * d] as [number, number]);
  return (
    <article className="cmp-col" aria-labelledby={`cmp-${id}`}>
      <header className="cmp-col-head">
        <h2 id={`cmp-${id}`} className="h-section">
          <Link to={testHref(id)}>#{id}</Link>
        </h2>
        <button type="button" className="btn ghost" onClick={onRemove} aria-label={`Remove test ${id}`}>
          Remove
        </button>
      </header>
      <p className="mono small">
        {t.fuel} · {num(t.p_atm, 2, "atm")} · {pct(t.x_o2)} O₂ · {chem(t.diluent)}
      </p>
      <p className="small">
        <EndMark type={t.end_type} /> <span className="muted">· {fiberLabel(t.fiber)}</span>
      </p>
      <MediaBlock t={t} compact />
      {d2.length > 0 ? (
        <TimeChart
          series={[{ id: "d2", label: "d²", points: d2 }]}
          xLabel="time, s"
          yLabel="d², mm²"
          height={180}
          xDomain={domain.x}
          yDomain={domain.y}
          ariaLabel={`Droplet diameter squared over time, test ${id}`}
          markers={t.burn_time_s ? [{ x: t.burn_time_s, label: "out" }] : []}
        />
      ) : (
        <p className="muted small">No measured series.</p>
      )}
      <dl className="kv">
        <dt>d₀</dt>
        <dd>{num(t.d0_mm, 2, "mm")}</dd>
        <dt>K</dt>
        <dd>{num(t.k_mm2_s, 2, "mm²/s")}</dd>
        <dt>Burn time</dt>
        <dd>{num(t.burn_time_s, 1, "s")}</dd>
      </dl>
      {t.comment && (
        <blockquote className="ex-quote">
          “{t.comment.length > EXCERPT ? `${t.comment.slice(0, EXCERPT)}…` : t.comment}”
        </blockquote>
      )}
    </article>
  );
}
