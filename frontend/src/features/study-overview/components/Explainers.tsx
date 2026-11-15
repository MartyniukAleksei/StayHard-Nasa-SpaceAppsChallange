import { EndMark, END_TYPES } from "@/shared/ui/EndMark";
import { END_DEFINITIONS, FINDINGS, HOW_IT_WORKED, TRAPS } from "../content";

/** Row of three: how it worked (B) · what was found (D) · traps (Q). */
export function Explainers() {
  return (
    <section className="band" aria-label="How to read FLEX">
      <div className="wrap">
        <div className="cells ov-explainers">
          <HowItWorked />
          <Findings />
          <Traps />
        </div>
      </div>
    </section>
  );
}

function HowItWorked() {
  return (
    <article className="cell">
      <h2 className="h-section">How it worked</h2>
      <ol className="ov-steps">
        {HOW_IT_WORKED.map((s) => (
          <li key={s}>{s}</li>
        ))}
        <li>
          Every test ends one of three ways:
          <ul className="ov-ends-list">
            {END_TYPES.map((t) => (
              <li key={t}>
                <EndMark type={t} /> — {END_DEFINITIONS[t]}
              </li>
            ))}
          </ul>
        </li>
      </ol>
    </article>
  );
}

function Findings() {
  return (
    <article className="cell">
      <h2 className="h-section">What was found</h2>
      {FINDINGS.length === 0 ? (
        <p className="placeholder" role="note">
          TODO (team): add 3 findings — each with a test № and a publication DOI.
        </p>
      ) : (
        <ul className="ov-findings">
          {FINDINGS.map((f) => (
            <li key={f.text}>
              {f.text}{" "}
              <span className="muted small mono">
                test #{f.test} ·{" "}
                <a href={`https://doi.org/${f.doi}`} target="_blank" rel="noreferrer">
                  doi:{f.doi}
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Traps() {
  return (
    <article className="cell">
      <h2 className="h-section">Two traps</h2>
      <ul className="ov-traps">
        {TRAPS.map((t) => (
          <li key={t.title}>
            <h3>{t.title}</h3>
            <p>{t.body}</p>
            {t.cite && (
              <blockquote className="ov-quote">
                “{t.cite.quote}”<cite className="mono">researcher comment, test #{t.cite.test}</cite>
              </blockquote>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
