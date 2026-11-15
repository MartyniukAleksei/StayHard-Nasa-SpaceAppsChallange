import { bytes } from "@/shared/lib/format";
import { CopyButton } from "@/shared/ui/CopyButton";
import { apiUrl } from "../api";
import type { DocGroup, Overview } from "../types";

export function Loading({ what }: { what: string }) {
  return <p className="wrap band muted mono">Loading {what}…</p>;
}

export function LoadError({ message }: { message?: string }) {
  return (
    <div className="wrap band">
      <p className="placeholder" role="alert">
        Could not load SAME-R data ({message}). Is the backend running and the database built with the data-psi-studies snapshot
        (docs/data/same_r.md §10)?
      </p>
    </div>
  );
}

export function FileLinks({ files }: { files: DocGroup["files"] }) {
  return (
    <ul className="sr-files">
      {files.map((f) => (
        <li key={f.url}>
          <a href={apiUrl(f.url)} target="_blank" rel="noreferrer">
            {f.title}
          </a>
          <span className="muted small">
            {f.name.split(".").pop()?.toUpperCase()}
            {!f.local && " · NASA PSI"}
          </span>
          <span className="mono small muted">{bytes(f.bytes)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Cite({ o }: { o: Overview }) {
  if (!o.doi) return null;
  const citation = `${o.title} (${o.acronym}, ${o.accession}). NASA Physical Sciences Informatics. https://doi.org/${o.doi}`;
  return (
    <section className="band" aria-labelledby="sr-cite">
      <div className="wrap">
        <h2 id="sr-cite" className="h-section">How to cite</h2>
        <div className="sr-cite">
          <p className="mono small">{citation}</p>
          <CopyButton text={citation} />
        </div>
        <p className="small muted">Data: CC0. Please cite the DOI.</p>
        <details>
          <summary>Objective and hypothesis</summary>
          <div className="body">
            <h3>Objective</h3>
            <p>{o.objective}</p>
            <h3>Hypothesis</h3>
            <p>{o.hypothesis}</p>
          </div>
        </details>
      </div>
    </section>
  );
}
