import { useState } from "react";
import type { About } from "../types";

/** Collapsed study passport (A): objective, hypothesis, team, citation. */
export function AboutDetails({ about }: { about: About }) {
  return (
    <section className="band" aria-label="About the study">
      <div className="wrap">
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
        <details>
          <summary>
            How to cite <span className="muted mono small">doi:{about.doi}</span>
          </summary>
          <div className="body">
            <Citation text={about.citation} />
            <p className="small">
              License:{" "}
              <a href={about.license_link} target="_blank" rel="noreferrer">
                {about.license_name}
              </a>
              . {about.n_publications} related publications ({about.n_publications_with_doi} with
              a DOI) — library coming soon.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}

type CopyState = "idle" | "copied" | "failed";
const COPY_LABEL: Record<CopyState, string> = {
  idle: "Copy",
  copied: "Copied",
  failed: "Select and copy manually",
};
const COPY_RESET_MS = 1800;

function Citation({ text }: { text: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), COPY_RESET_MS);
  };
  return (
    <div className="ov-cite">
      <p className="mono small">{text}</p>
      <button type="button" className="btn" onClick={copy}>
        {COPY_LABEL[state]}
      </button>
    </div>
  );
}
