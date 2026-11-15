import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { testHref, useTest, type TestSummary } from "@/features/flex-tests";
import { useReplay } from "@/features/replay";
import { chem, fiberLabel, num, pct } from "@/shared/lib/format";
import { TimeChart } from "@/shared/ui/chart/TimeChart";
import { EndMark } from "@/shared/ui/EndMark";

const EXCERPT = 280;

type Props = {
  test: TestSummary;
  inCompare: boolean;
  compareFull: boolean;
  onToggleCompare: () => void;
  onClose: () => void;
};

/** E + F: quick look at one test without leaving the explorer, in a modal dialog
 *  (Esc, the backdrop or Close shut it; focus stays inside while it is open). */
export function Preview({ test, inCompare, compareFull, onToggleCompare, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  const detail = useTest(test.test_no);
  const replay = useReplay(test.test_no);
  const comment = detail.data?.comment ?? "";
  const d2 = (replay.data?.droplet ?? []).map(([t, d]) => [t, d * d] as [number, number]);

  return (
    <dialog
      ref={dialog}
      className="ex-preview"
      aria-label={`Preview of test ${test.test_no}`}
      onCancel={(e) => {
        // Esc: let React state close it (the dialog's own close event also fires on unmount)
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <div className="ex-preview-head">
        <h2 className="h-section">#{test.test_no}</h2>
        <button type="button" className="btn ghost ex-close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mono small">
        {test.fuel} · {num(test.p_atm, 2, "atm")} · {pct(test.x_o2)} O₂ · {chem(test.diluent)} ·{" "}
        <EndMark type={test.end_type} />
      </p>
      <p className="small muted">
        {fiberLabel(test.fiber)}
        {test.cool_flame && " · cool flame mentioned (derived)"}
        {test.has_video && " · video"}
      </p>
      <dl className="kv">
        <dt>d₀</dt>
        <dd>{num(test.d0_mm, 2, "mm")}</dd>
        <dt>d_ext</dt>
        <dd>{num(test.dext_mm, 2, "mm")}</dd>
        <dt>K</dt>
        <dd>{num(test.k_mm2_s, 2, "mm²/s")}</dd>
        <dt>Burn time</dt>
        <dd>{num(test.burn_time_s, 1, "s")}</dd>
      </dl>
      {d2.length > 0 && (
        <TimeChart
          series={[{ id: "d2", label: "d² measured", points: d2 }]}
          xLabel="t, s"
          yLabel="d², mm²"
          height={150}
          ariaLabel={`Droplet diameter squared over time, test ${test.test_no}`}
          markers={test.burn_time_s ? [{ x: test.burn_time_s, label: "flame out" }] : []}
        />
      )}
      {comment && (
        <blockquote className="ex-quote">
          “{comment.length > EXCERPT ? `${comment.slice(0, EXCERPT)}…` : comment}”
        </blockquote>
      )}
      <div className="ex-preview-actions">
        <Link to={testHref(test.test_no)} className="btn">
          Open test
        </Link>
        <button
          type="button"
          className="btn ghost"
          onClick={onToggleCompare}
          disabled={!inCompare && compareFull}
          aria-pressed={inCompare}
        >
          {inCompare ? "Remove from compare" : "Add to compare"}
        </button>
      </div>
    </dialog>
  );
}
