import { useEffect, useMemo, useRef } from "react";
import { renderAscii } from "@/features/replay";
import { useTests } from "@/features/flex-tests";
import { EndMark, END_TYPES, type EndType } from "@/shared/ui/EndMark";
import { END_DEFINITIONS, HOW_IT_WORKED } from "../content";

// Scheme geometry in viewBox units (300 × 200, frame height = 1 unit of the ASCII scene = 200).
const SCENE = { rd: 0.06, rf: 0.3 };
const CX = 150, CY = 100, U = 200;
const RD = SCENE.rd * U, RF = SCENE.rf * U;
const pct = (x: number, y: number) => ({ left: `${(x / 300) * 100}%`, top: `${(y / 200) * 100}%` });

/** Schematic of one burning droplet in microgravity, drawn as a still ASCII frame. Not to scale. */
function Scheme() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let alive = true;
    const draw = () => {
      const cs = getComputedStyle(cv);
      const v = (n: string) => cs.getPropertyValue(n).trim();
      renderAscii(cv, SCENE, 0, { bg: v("--deep"), ink: v("--ink"), flame: v("--flame"), font: v("--mono") });
    };
    draw();
    document.fonts.ready.then(() => alive && draw());
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, []);
  const dY = CY - RD - 10;
  const fY = CY + RF + 20;
  return (
    <figure className="hw-fig">
      <div
        className="hw-frame"
        role="img"
        aria-label="Schematic: a fuel droplet of diameter d at the centre of a spherical flame of diameter D_flame, inside the combustion chamber"
      >
        <canvas ref={ref} aria-hidden="true" />
        <svg viewBox="0 0 300 200" aria-hidden="true">
          <path className="hw-dim" d={`M${CX - RD} ${dY - 3}v6M${CX - RD} ${dY}H${CX + RD}M${CX + RD} ${dY - 3}v6`} />
          <path className="hw-dim hw-dim-f" d={`M${CX - RF} ${fY - 4}v8M${CX - RF} ${fY}H${CX + RF}M${CX + RF} ${fY - 4}v8`} />
        </svg>
        <span className="hw-lab hw-muted" style={{ left: "12px", top: "10px" }}>combustion chamber · μg</span>
        <span className="tag hw-tag">schematic</span>
        <span className="hw-lab" style={pct(CX + RD + 6, dY)}>d</span>
        <span className="hw-lab hw-lab-f" style={pct(CX + RF + 8, fY)}>D_flame</span>
      </div>
      <figcaption className="mono small">
        Not to scale. Flame standoff ratio FSR = D_flame / d; burning rate K from d² = d₀² − K·t.
      </figcaption>
    </figure>
  );
}

/** B: how the experiment worked: scheme, steps, and how many tests ended each way. */
const c_sum = (c: Record<EndType, number>) => c.Extinction + c.Disruption + c.Completion;

export function HowItWorked() {
  const { data: tests } = useTests();
  const counts = useMemo(() => {
    const c: Record<EndType, number> = { Extinction: 0, Disruption: 0, Completion: 0 };
    // free-floating droplets only: fiber-supported tests are never mixed in (docs/data/flex.md)
    for (const t of tests ?? []) if (t.fiber === false) c[t.end_type]++;
    return c;
  }, [tests]);
  const total = c_sum(counts);
  const all = tests?.length ?? 0;
  return (
    <section className="band" aria-labelledby="how-title">
      <div className="wrap">
        <h2 id="how-title" className="h-section">How it worked</h2>
        <div className="hw">
          <Scheme />
          <ol className="cells hw-steps">
            {HOW_IT_WORKED.map((s, i) => (
              <li key={s} className="cell">
                <span className="mono small muted">{String(i + 1).padStart(2, "0")}</span>
                <p>{s}</p>
              </li>
            ))}
          </ol>
        </div>
        <h3 className="hw-sub mono small">How a test ends</h3>
        {all > 0 && (
          <p className="small muted hw-note">
            Free-floating droplets only: {total} of {all} tests. Tests on a fiber, or with the fiber unknown, are not mixed in.
          </p>
        )}
        <ul className="cells hw-ends">
          {END_TYPES.map((t) => (
            <li key={t} className="cell hw-end">
              <EndMark type={t} />
              <p className="hw-count">
                {total ? counts[t] : "—"}
                <span className="mono small muted"> of {total || "—"} free-floating tests</span>
              </p>
              <p className="small muted">{END_DEFINITIONS[t]}</p>
              {total > 0 && (
                <div className={`hw-bar hw-bar-${t.toLowerCase().slice(0, 3)}`} aria-hidden="true">
                  <i style={{ width: `${(counts[t] / total) * 100}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
