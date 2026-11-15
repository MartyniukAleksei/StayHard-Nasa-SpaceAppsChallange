import { num } from "@/shared/lib/format";
import type { D2Fit } from "../lib/d2fit";

type Props = {
  fit: D2Fit | null;
  /** NASA-reported values for this test */
  nasaK: number | null;
  d0: number | null;
  gaps: [number, number][];
};

const D2 = (
  <>
    d<sup>2</sup>
  </>
);

/** The d² law in words and formulas, our fitted K (estimate) next to NASA's K. */
export function D2Explainer({ fit, nasaK, d0, gaps }: Props) {
  const tb = fit && d0 != null ? (d0 * d0) / fit.k : null;
  return (
    <div className="tp-d2">
      <div className="tp-d2-k">
        {fit ? (
          <p>
            <span className="tag">derived</span> Our estimate: <b className="mono">K ≈ {num(fit.k, 2, "mm²/s")}</b>{" "}
            <span className="mono small muted">
              (R² = {fit.r2.toFixed(3)}, {fit.n} points, {num(fit.t0, 1)}–{num(fit.t1, 1, "s")})
            </span>
          </p>
        ) : (
          <p className="muted">Too few points in the burning phase to estimate K ourselves.</p>
        )}
        <p>
          NASA reports <b className="mono">K = {num(nasaK, 2, "mm²/s")}</b>
          {nasaK == null && <span className="muted"> (not in the data)</span>}
        </p>
      </div>

      <dl className="tp-formulas">
        <dt>The d² law</dt>
        <dd>
          <span className="math">
            d(t)<sup>2</sup> = d<sub>0</sub>
            <sup>2</sup> − K·t
          </span>
          , where d<sub>0</sub> is the initial droplet diameter and K is the burning-rate constant, mm²/s.
        </dd>
        <dt>K from the chart</dt>
        <dd>
          Plotted as {D2} against time, the burning droplet falls on a straight line; K is the
          absolute value of its slope: <span className="math">K = −Δ(d<sup>2</sup>)/Δt</span>.
        </dd>
        <dt>Burn-out time</dt>
        <dd>
          <span className="math">
            t<sub>b</sub> = d<sub>0</sub>
            <sup>2</sup> / K
          </span>
          {tb != null && (
            <>
              {" "}
              — with NASA’s d<sub>0</sub> = {num(d0, 2, "mm")} and our K: t<sub>b</sub> ≈ {num(tb, 1, "s")}{" "}
              <span className="muted">(estimate; extinction or the end of the test can come first)</span>
            </>
          )}
          .
        </dd>
        <dt>Why the start bends</dt>
        <dd>
          Right after ignition the droplet is still heating up and can even swell, so the first points
          sit above the line. Our fit starts at the largest {D2} (the end of heat-up) and stops at
          flame-out.
        </dd>
        {gaps.length > 0 && (
          <>
            <dt>Missing stretch</dt>
            <dd>
              No measurements between{" "}
              {gaps.map(([a, b], i) => (
                <span key={a} className="mono">
                  {i > 0 && ", "}
                  {num(a, 1)}–{num(b, 1, "s")}
                </span>
              ))}{" "}
              (shaded on the chart): the droplet was not tracked there, so the line is not drawn
              through invented points.
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
