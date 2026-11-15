import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { DETECTOR_LABELS, PTRAK_LIMIT } from "@/features/same-r-3d";
import { TimeChart } from "@/shared/ui/chart/TimeChart";
import { useSameRSeries } from "../api";
import { testHref } from "../lib/compare";
import { column, heaterOff, type TestGroup } from "../lib/tests";
import { Mark } from "./Mark";

type Props = {
  g: TestGroup;
  mark: number;
  inCompare: boolean;
  compareFull: boolean;
  onToggleCompare: () => void;
  onClose: () => void;
};

const val = (v: number | string | null | undefined, unit = "") => (v == null ? "not recorded" : typeof v === "number" ? `${v}${unit}` : v);

/** Quick look at one test without leaving the list, in a modal dialog (Esc, the backdrop or Close shut it). */
export function Preview({ g, mark, inCompare, compareFull, onToggleCompare, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  const { main, aged } = g;
  const peak = main.ptrak_peak_per_cc;
  const detectors = (main.active_detectors ?? []).map((d) => DETECTOR_LABELS[d] ?? d);
  const { data: s } = useSameRSeries(g.test_no, main.has_timeseries);
  const ptrak = s ? column(s, "ptrak_per_cc") : [];
  const off = s ? heaterOff(s) : null;

  return (
    <dialog
      ref={dialog}
      className="sr-preview"
      aria-label={`Preview of test ${main.test_id}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <div className="sr-preview-head">
        <h2 className="h-section">#{main.test_id}</h2>
        <button type="button" className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mono small">
        <Mark i={mark} /> {val(main.material)}
        {main.description ? ` · ${main.description}` : ""}
      </p>
      <dl className="sr-kv">
        <dt>Date, 2010</dt>
        <dd>{val(main.date_2010)}</dd>
        <dt>Heater Rt/R0</dt>
        <dd>{val(main.heater_rt_r0)}</dd>
        <dt>Measured again after aging</dt>
        <dd>{aged ? `yes, row ${aged.test_id} · ${val(aged.net_aging_s, " s")}` : "no"}</dd>
        <dt>Peak particle count, P-Trak</dt>
        <dd>{peak == null ? "no telemetry" : `${peak >= PTRAK_LIMIT ? "≥ " : ""}${peak.toLocaleString("en-US")} / cm³`}</dd>
        <dt>Active detectors</dt>
        <dd>{detectors.length ? detectors.join(", ") : "none recorded"}</dd>
        <dt>TEM images</dt>
        <dd>{main.has_tem ? "yes" : "no"}</dd>
      </dl>
      {ptrak.length > 0 && (
        <TimeChart
          series={[{ id: "p", label: "P-Trak", points: ptrak, kind: "line", tone: "s2" }]}
          xLabel="time, s"
          yLabel="particles / cm³"
          height={150}
          ariaLabel={`Particle count over time, test ${main.test_id}`}
          markers={[{ x: 0, label: off != null ? `heater on 0–${off} s` : "heater on" }]}
        />
      )}
      <div className="sr-preview-actions">
        <Link to={testHref(g.test_no)} className="btn">
          Open test
        </Link>
        <button type="button" className="btn ghost" onClick={onToggleCompare} disabled={!inCompare && compareFull} aria-pressed={inCompare}>
          {inCompare ? "Remove from compare" : "Add to compare"}
        </button>
      </div>
    </dialog>
  );
}
