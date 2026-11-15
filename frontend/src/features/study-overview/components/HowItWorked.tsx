import { useMemo } from "react";
import { useTests } from "@/features/flex-tests";
import { EndMark, END_TYPES, type EndType } from "@/shared/ui/EndMark";
import { END_DEFINITIONS, HOW_IT_WORKED } from "../content";

/** Schematic of one burning droplet in microgravity. Not to scale: it only names the quantities used on this page. */
function Scheme() {
  return (
    <figure className="hw-fig">
      <svg viewBox="0 0 400 260" role="img" aria-label="Schematic: a fuel droplet of diameter d at the centre of a spherical flame of diameter D_flame, inside the combustion chamber">
        <rect x="6" y="6" width="388" height="248" className="hw-chamber" />
        <circle cx="200" cy="130" r="92" className="hw-flame" />
        <circle cx="200" cy="130" r="18" className="hw-drop" />
        <line x1="182" y1="130" x2="218" y2="130" className="hw-dim hw-dim-d" />
        <line x1="108" y1="206" x2="292" y2="206" className="hw-dim hw-dim-f" />
        <line x1="108" y1="200" x2="108" y2="212" className="hw-dim hw-dim-f" />
        <line x1="292" y1="200" x2="292" y2="212" className="hw-dim hw-dim-f" />
        <text x="200" y="168" textAnchor="middle" className="hw-lab">droplet, d</text>
        <text x="200" y="228" textAnchor="middle" className="hw-lab hw-lab-f">flame, D_flame</text>
        <text x="14" y="24" className="hw-lab hw-muted">combustion chamber</text>
        <text x="386" y="24" textAnchor="end" className="hw-lab hw-muted">no buoyancy: spherical flame</text>
      </svg>
      <figcaption className="mono small">
        Schematic, not to scale. Flame standoff ratio FSR = D_flame / d; burning rate K from d² = d₀² − K·t.
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
          <ol className="ov-steps">
            {HOW_IT_WORKED.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <h3 className="hw-sub mono small">How a test ends</h3>
        {all > 0 && (
          <p className="small muted hw-note">
            Free-floating droplets only: {total} of {all} tests. Tests on a fiber, or with the fiber unknown, are not mixed in.
          </p>
        )}
        <ul className="hw-ends">
          {END_TYPES.map((t) => (
            <li key={t} className="hw-end">
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
