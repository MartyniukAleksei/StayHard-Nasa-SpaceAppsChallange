import type { ReactNode } from "react";
import { SOURCES } from "../sources";
import { parseCited } from "../lib/cited";

/** Renders copy with [[source-id]] markers as citation links to the source list at the bottom. */
export function Cited({ text }: { text: string }) {
  return (
    <>
      {parseCited(text).map((p, i) => {
        if (p.kind === "text") return <span key={i}>{p.text}</span>;
        const src = SOURCES[p.id];
        return (
          <span key={i}>
            {" "}
            <a className="cf-cite" href={`#src-${p.id}`} title={src?.citation}>
              [{src?.short ?? p.id}]
            </a>
          </span>
        );
      })}
    </>
  );
}

export function Callout({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <aside className="cf-callout">
      <p className="cf-callout-label mono">{label}</p>
      <h3 className="cf-callout-title">{title}</h3>
      {children}
    </aside>
  );
}
