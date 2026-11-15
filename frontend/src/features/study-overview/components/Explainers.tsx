import { DropletReplay } from "@/features/replay";
import { EndMark, END_TYPES } from "@/shared/ui/EndMark";
import { Placeholder } from "@/shared/ui/Placeholder";
import { DEMO_TEST, END_DEFINITIONS, FINDINGS, HOW_IT_WORKED, TRAPS } from "../content";

/** G: full-width replay of the demo test, rebuilt from measured series. */
export function ReplaySection() {
  return (
    <section className="band" aria-label={`Replay of test ${DEMO_TEST}`}>
      <div className="wrap ov-replay">
        <DropletReplay testNo={DEMO_TEST} />
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
  return (
    <section className="band" aria-labelledby="found-title">
      <div className="wrap ov-narrow">
        <h2 id="found-title" className="h-section">What was found</h2>
        {FINDINGS.length === 0 ? (
          <Placeholder>add 3 findings — each with a test № and a publication DOI.</Placeholder>
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
