import { Link } from "react-router";
import { CopyButton } from "@/shared/ui/CopyButton";
import type { About } from "../types";

/** A: how to cite (always visible) + the collapsed study passport. */
export function AboutDetails({ about }: { about: About }) {
  return (
    <section className="band" aria-labelledby="cite-title">
      <div className="wrap">
        <h2 id="cite-title" className="h-section">How to cite</h2>
        <div className="ov-cite">
          <p className="mono small">{about.citation}</p>
          <CopyButton text={about.citation} />
        </div>
        <p className="small muted">
          License:{" "}
          <a href={about.license_link} target="_blank" rel="noreferrer">
            {about.license_name}
          </a>
          . {about.n_publications} related publications ({about.n_publications_with_doi} with a
          DOI) in the <Link to="/studies/flex/library#publications">Library</Link>.
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
