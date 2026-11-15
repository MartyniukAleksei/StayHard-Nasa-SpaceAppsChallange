import { Link } from "react-router";
import { CopyButton } from "@/shared/ui/CopyButton";
import { FINDINGS } from "../content";
import { REFS } from "../refs";
import { CARD_107, CARD_117, CARD_13 } from "../testCards";
import type { About } from "../types";

/** Ids in the order they first appear on the page: cards, then findings. */
function usedRefs(): string[] {
  const ids = [...CARD_107.notes, ...CARD_13.notes, ...CARD_117.notes].flatMap((n) => n.refs).concat(FINDINGS.flatMap((f) => f.refs));
  return [...new Set(ids)];
}

/** References for everything cited above, then the dataset citation FLEX asks for, the licence and the passport. */
export function References({ about }: { about: About }) {
  const ids = usedRefs().filter((id) => id !== "psi69");
  return (
    <section className="band" aria-labelledby="refs-title">
      <div className="wrap">
        <h2 id="refs-title" className="h-section">References</h2>
        <ol className="ov-refs">
          {ids.map((id) => (
            <li key={id}>
              {REFS[id].full}{" "}
              <a className="mono small" href={REFS[id].href} target="_blank" rel="noreferrer">
                {REFS[id].href.replace("https://", "")}
              </a>
            </li>
          ))}
        </ol>
        <h3 className="ov-refs-sub mono small">Data</h3>
        <div className="ov-cite">
          <p className="mono small">{about.citation}</p>
          <CopyButton text={about.citation} />
        </div>
        <p className="small muted">
          License:{" "}
          <a href={about.license_link} target="_blank" rel="noreferrer">
            {about.license_name}
          </a>
          . {about.n_publications} related publications ({about.n_publications_with_doi} with a DOI) in the{" "}
          <Link to="/studies/flex/library#publications">Library</Link>.
        </p>
        <details>
          <summary>Objective, hypothesis and team</summary>
          <div className="body">
            <h3>Objective</h3>
            <p>{about.objective}</p>
            <h3>Hypothesis</h3>
            <p>{about.hypothesis}</p>
            <h3>Hardware</h3>
            <p>
              {about.hardware} · {about.flight_program}
            </p>
            <h3>Team</h3>
            <ul className="ov-team">
              {about.contacts.map((c) => (
                <li key={c.name}>
                  {c.name} <span className="muted">· {c.role} · {c.affiliation}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </section>
  );
}
