import { useEffect } from "react";
import { useLocation } from "react-router";
import { useSameROverview } from "../api";
import { DICTIONARY, TRAPS } from "../content";
import { Cite, FileLinks, LoadError, Loading } from "./Common";
import { IssPhotos } from "./Photos";
import "./same-r.css";

const SECTIONS = [
  { id: "documents", label: "Documents" },
  { id: "dictionary", label: "Data dictionary" },
  { id: "limitations", label: "Limitations" },
  { id: "photos", label: "Photos" },
  { id: "cite", label: "How to cite" },
];

/** Library: NASA documents, what the table columns mean, the caveats, every crew photo, and how to cite. */
export function SameRLibrary() {
  const { data: o, isPending, isError, error } = useSameROverview();
  const { hash } = useLocation();
  // Deep links (#dictionary…) target sections that exist only after the data loads.
  useEffect(() => {
    if (o && hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [o, hash]);
  if (isPending) return <Loading what="library" />;
  if (isError) return <LoadError message={error.message} />;
  return (
    <div className="sr">
      <section className="band" aria-labelledby="sr-docs">
        <div className="wrap">
          <h1 id="sr-docs" className="h-display">Library</h1>
          <nav className="sr-toc" aria-label="Library sections">
            <ul>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <p id="documents" className="lede sr-anchor">
            NASA documents from the SAME-R dataset. Files open from the local snapshot.
          </p>
          <div className="sr-docs">
            {o.documents.map((g) => (
              <div key={g.category}>
                <h2 className="sr-sub">{g.category}</h2>
                <FileLinks files={g.files} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="dictionary" className="band sr-anchor" aria-labelledby="sr-dict">
        <div className="wrap">
          <h2 id="sr-dict" className="h-section">Data dictionary</h2>
          <p className="lede">Columns of the experiment table, as NASA PSI publishes them.</p>
          <dl className="sr-kv">
            {DICTIONARY.map((d) => [
              <dt key={`${d.field}-k`} className="mono">
                {d.field}
              </dt>,
              <dd key={`${d.field}-v`}>{d.meaning}</dd>,
            ])}
          </dl>
        </div>
      </section>
      <section id="limitations" className="band sr-anchor" aria-labelledby="sr-limits">
        <div className="wrap">
          <h2 id="sr-limits" className="h-section">Limitations</h2>
          <ul className="sr-traps">
            {TRAPS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>
      <section id="photos" className="band sr-anchor" aria-labelledby="sr-photos">
        <div className="wrap">
          <h2 id="sr-photos" className="h-section">Photos from the ISS</h2>
          <IssPhotos />
        </div>
      </section>
      <div id="cite" className="sr-anchor">
        <Cite o={o} />
      </div>
    </div>
  );
}
