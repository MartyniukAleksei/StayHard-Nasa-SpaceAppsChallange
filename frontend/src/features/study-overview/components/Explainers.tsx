import { EndMark, END_TYPES } from "@/shared/ui/EndMark";
import { Link } from "react-router";
import { END_DEFINITIONS, FINDINGS, HOW_IT_WORKED, TRAPS } from "../content";

/** Link to the explorer, at the end of the story. */
export function BrowseTests() {
  return (
    <section className="band" aria-label="All tests">
      <div className="wrap ov-browse">
        <p className="lede">Every test, filterable by fuel, oxygen, pressure and outcome.</p>
        <Link className="btn" to="/studies/flex/tests">
          Browse all tests →
        </Link>
      </div>
    </section>
  );
}

/** B: how the experiment worked. */
export function HowItWorked() {
  return (
    <section className="band" aria-labelledby="how-title">
      <div className="wrap ov-narrow">
        <h2 id="how-title" className="h-section">How it worked</h2>
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
      </div>
    </section>
  );
}

/** D: what was found — curated by the team, each finding cites a test and a publication. */
export function Findings() {
  if (FINDINGS.length === 0) return null;
  return (
    <section className="band" aria-labelledby="found-title">
      <div className="wrap ov-narrow">
        <h2 id="found-title" className="h-section">What was found</h2>
        <ol className="ov-findings">
          {FINDINGS.map((f) => (
            <li key={f.text}>
              <p>{f.text}</p>
              <p className="small mono">
                <Link to={`/studies/flex/tests/${f.test}`}>see test #{f.test}</Link>
                <span className="muted"> · </span>
                <a className="muted" href={`https://doi.org/${f.doi}`} target="_blank" rel="noreferrer">
                  doi:{f.doi}
                </a>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Q: two common misreadings of the data. */
export function Traps() {
  return (
    <section className="band" aria-labelledby="traps-title">
      <div className="wrap">
        <h2 id="traps-title" className="h-section">Two traps</h2>
        <ul className="cells ov-traps">
          {TRAPS.map((t) => (
            <li key={t.title} className="cell">
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
      </div>
    </section>
  );
}
