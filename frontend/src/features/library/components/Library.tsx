import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { testHref, useLibrary, type Library as LibraryData } from "@/features/flex-tests";
import { FileList } from "@/features/test-page";
import { CopyButton } from "@/shared/ui/CopyButton";
import { Placeholder } from "@/shared/ui/Placeholder";
import { CAVEATS, PUB_TOPICS, SECTIONS, SERIES_FIELDS, TEST_FIELDS, type Field } from "../content";
import "./library.css";

/** 5B: documentation page — sticky anchor menu, one scroll, a direct link to every section. */
export function Library() {
  const { data, isPending, isError, error } = useLibrary();
  const { hash } = useLocation();
  // Deep links (#publications…) target sections that exist only after the data loads.
  useEffect(() => {
    if (data && hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [data, hash]);
  if (isPending) return <p className="wrap band muted mono">Loading library…</p>;
  if (isError) {
    return (
      <div className="wrap band">
        <p className="placeholder" role="alert">
          Could not load the library ({error.message}).
        </p>
      </div>
    );
  }
  return (
    <div className="wrap lib">
      <header className="lib-head">
        <p className="ov-kicker mono">FLEX · Library and data</p>
        <h1 className="h-display">Sources, data dictionary and how to cite</h1>
      </header>
      <div className="lib-grid">
        <nav className="lib-nav" aria-label="Library sections">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lib-body">
          <Cite data={data} />
          <Section id="cart" title="Lab cart">
            <Placeholder>
              lab cart — pick tests and download one ZIP: tests.csv + time series + README with the
              citation. Until then, use “Download series (CSV)” on each test page.
            </Placeholder>
          </Section>
          <Section id="dictionary" title="Data dictionary">
            <p className="lede">Fields of every test, as returned by the API and shown on test pages.</p>
            <FieldTable fields={TEST_FIELDS} caption="Test fields" />
            <p className="lede">Columns of <code>series.csv</code>, downloadable from each test page.</p>
            <FieldTable fields={SERIES_FIELDS} caption="Time-series columns" />
          </Section>
          <Limits data={data} />
          <Publications pubs={data.publications} />
          <Section id="documents" title="NASA documents">
            {data.documents.map((g) => (
              <div key={g.category} className="lib-docs">
                <h3>{g.category}</h3>
                <FileList files={g.files} />
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="lib-sec" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="h-section">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Cite({ data }: { data: LibraryData }) {
  return (
    <Section id="cite" title="How to cite">
      <div className="lib-cite">
        <p className="mono small">{data.citation}</p>
        <CopyButton text={data.citation} />
      </div>
      <p className="small muted">
        DOI{" "}
        <a href={`https://doi.org/${data.doi}`} target="_blank" rel="noreferrer">
          {data.doi}
        </a>{" "}
        · License{" "}
        <a href={data.license_link} target="_blank" rel="noreferrer">
          {data.license_name}
        </a>
        . The data is free to reuse; please cite the DOI.
      </p>
    </Section>
  );
}

function FieldTable({ fields, caption }: { fields: Field[]; caption: string }) {
  return (
    <div className="lib-table-wrap">
      <table className="lib-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Unit</th>
            <th scope="col">Meaning</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name}>
              <th scope="row" className="mono">
                {f.name}
              </th>
              <td className="mono small">{f.unit}</td>
              <td>
                {f.meaning} {f.derived && <span className="tag lib-derived">derived</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Limits({ data }: { data: LibraryData }) {
  const l = data.limitations;
  const rows: [string, number, string][] = [
    ["free-floating droplets", l.free, `of ${l.total} tests`],
    ["on a support fiber", l.fiber, "kept separate from free droplets"],
    ["fiber status unknown", l.fiber_unknown, "excluded from free-droplet counts"],
    ["Disruption", l.disruption, "self-extinction not observed — not “would burn forever”"],
    ["no initial diameter d₀", l.missing_d0, "tests"],
    ["no burning rate K", l.missing_k, "tests"],
    ["no droplet + flame series", l.without_series, "tests"],
    ["with video", l.with_video, "tests; the rest have a replay from data"],
  ];
  return (
    <Section id="limitations" title="Limitations">
      <ul className="cells lib-limits">
        {rows.map(([label, n, note]) => (
          <li key={label} className="cell stat">
            <b>{n}</b>
            <span>
              {label} · {note}
            </span>
          </li>
        ))}
      </ul>
      <ul className="lib-caveats">
        {CAVEATS.map((c) => (
          <li key={c.text}>
            {c.text}
            {c.test != null && (
              <>
                {" "}
                <Link className="mono small" to={testHref(c.test)}>
                  test #{c.test}
                </Link>
              </>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Publications({ pubs }: { pubs: LibraryData["publications"] }) {
  const [topic, setTopic] = useState<string | null>(null);
  const counts = useMemo(
    () => new Map(PUB_TOPICS.map((t) => [t.id, pubs.filter((p) => t.match.test(p.title)).length])),
    [pubs],
  );
  const active = PUB_TOPICS.find((t) => t.id === topic);
  const shown = active ? pubs.filter((p) => active.match.test(p.title)) : pubs;
  return (
    <Section id="publications" title="Publications">
      <div className="lib-chips" role="group" aria-label="Filter publications by topic">
        <button type="button" className={topic == null ? "tag on" : "tag"} aria-pressed={topic == null} onClick={() => setTopic(null)}>
          all {pubs.length}
        </button>
        {PUB_TOPICS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={topic === t.id ? "tag on" : "tag"}
            aria-pressed={topic === t.id}
            onClick={() => setTopic(t.id)}
          >
            {t.label} {counts.get(t.id)}
          </button>
        ))}
      </div>
      <p className="small muted">
        <span className="tag lib-derived">derived</span> Topics are a keyword match on titles.
      </p>
      <ol className="lib-pubs">
        {shown.map((p, i) => (
          <li key={`${p.doi || p.title}-${i}`}>
            <span>{p.title}</span>
            <span className="small muted">{p.authors}</span>
            {p.doi && (
              <a className="mono small" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">
                doi:{p.doi}
              </a>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}
