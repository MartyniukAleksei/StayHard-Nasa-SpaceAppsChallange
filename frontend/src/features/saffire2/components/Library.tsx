import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { CopyButton } from "@/shared/ui/CopyButton";
import { useSaffireDashboard } from "../api";
import { glyphOf, TRAPS } from "../content";
import { BASE, sampleHref } from "../lib/links";
import type { Dashboard } from "../types";
import { Conditions } from "./Conditions";
import { Failed, Loading } from "./SaffireOverview";
import "./saffire2.css";

const SECTIONS = [
  ["cite", "How to cite"],
  ["table", "Experiment table"],
  ["quality", "Data quality"],
  ["limits", "Limitations"],
  ["publications", "Publications"],
  ["documents", "Documents"],
  ["team", "Objective and team"],
] as const;

/** 5B like the FLEX library: documentation with a section menu and direct anchors. */
export function SaffireLibrary() {
  const { data, isPending, isError, error } = useSaffireDashboard();
  const { hash } = useLocation();
  useEffect(() => {
    if (data && hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [data, hash]);
  if (isPending) return <Loading />;
  if (isError) return <Failed message={error.message} />;
  return (
    <div className="wrap sfl">
      <header className="sfl-head">
        <p className="sf-kicker mono">
          <Link to={BASE}>SAFFIRE-II</Link> / Library
        </p>
        <h1 className="h-display">Library</h1>
        <p className="lede">Everything behind the Saffire-II pages: how to cite, the raw experiment table, data quality, papers and NASA documents.</p>
      </header>
      <div className="sfl-grid">
        <nav className="sfl-nav" aria-label="Library sections">
          <ul>
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sfl-body">
          <CiteSec data={data} />
          <TableSec data={data} />
          <section className="sfl-sec" id="quality" aria-labelledby="sfl-quality">
            <h2 id="sfl-quality" className="h-section">Data quality</h2>
            <Conditions data={data} />
          </section>
          <section className="sfl-sec" id="limits" aria-labelledby="sfl-limits">
            <h2 id="sfl-limits" className="h-section">Limitations</h2>
            <ul className="cells sf-traps" role="list">
              {TRAPS.map((t) => (
                <li key={t.title} className="cell">
                  <h3>{t.title}</h3>
                  <p className="muted">{t.body}</p>
                </li>
              ))}
            </ul>
          </section>
          <PubsSec data={data} />
          <DocsSec data={data} />
          <TeamSec data={data} />
        </div>
      </div>
    </div>
  );
}

function CiteSec({ data }: { data: Dashboard }) {
  const { about } = data;
  return (
    <section className="sfl-sec" id="cite" aria-labelledby="sfl-cite">
      <h2 id="sfl-cite" className="h-section">How to cite</h2>
      <div className="sf-cite-row">
        <p className="mono small">{about.citation}</p>
        <CopyButton text={about.citation} />
      </div>
      <p className="small muted">
        DOI{" "}
        <a href={`https://doi.org/${about.doi}`} target="_blank" rel="noreferrer">
          {about.doi}
        </a>{" "}
        · {about.accession} ·{" "}
        <a href={about.license_link} target="_blank" rel="noreferrer">
          {about.license_name}
        </a>
        . The data are public domain, but the DOI must be cited.
      </p>
    </section>
  );
}

function TableSec({ data }: { data: Dashboard }) {
  return (
    <section className="sfl-sec" id="table" aria-labelledby="sfl-table">
      <h2 id="sfl-table" className="h-section">Experiment table</h2>
      <p className="lede">The PSI table as published, cell by cell. The rest of the site parses these cells; the raw text is kept here.</p>
      <div className="sfl-table-wrap">
        <table className="sfl-table">
          <thead>
            <tr>
              <th scope="col">Sample</th>
              <th scope="col">Material</th>
              <th scope="col">Thickness</th>
              <th scope="col">Length</th>
              <th scope="col">Flow</th>
              <th scope="col">O₂</th>
              <th scope="col">Igniter</th>
              <th scope="col">Burn time</th>
              <th scope="col">µg burned / spread</th>
              <th scope="col">1g burned / spread</th>
              <th scope="col">Cameras</th>
            </tr>
          </thead>
          <tbody>
            {data.samples.map((s) => (
              <tr key={s.test_id}>
                <th scope="row">
                  <Link to={sampleHref(s.test_id)} className="mono">
                    {s.test_id}
                  </Link>
                </th>
                <td>
                  {glyphOf(s.material).glyph} {s.material}
                  {s.material_filled_down && <span className="tag sf-derived">carried down</span>}
                </td>
                <td className="mono">{s.thickness_raw}</td>
                <td className="mono">{s.length_raw}</td>
                <td className="mono">
                  {s.air_flow_cm_s} cm/s · {s.flow_direction}
                </td>
                <td className="mono">{s.o2_pct_table ?? "range"}</td>
                <td className="mono">
                  {s.ignition_power_w} W × {s.ignition_time_s} s
                </td>
                <td className="mono">{s.burn_time_s == null ? "—" : `${s.burn_time_s} s`}</td>
                <td className="mono">
                  {s.ug_burn_length_raw} / {s.ug_spread_raw}
                </td>
                <td className="mono">
                  {s.g1_burn_length_raw} / {s.g1_spread_rate_raw}
                </td>
                <td className="mono">{[s.camera1, s.camera2].filter(Boolean).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Notes under the table</h3>
      <ol className="sf-notes">
        {Object.entries(data.notes).map(([k, v]) => (
          <li key={k} value={Number(k)}>
            <span className="muted">{v}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PubsSec({ data }: { data: Dashboard }) {
  return (
    <section className="sfl-sec" id="publications" aria-labelledby="sfl-pubs">
      <h2 id="sfl-pubs" className="h-section">Publications</h2>
      <p className="lede">Papers that NASA PSI links to this investigation.</p>
      <ol className="sfl-pubs">
        {data.about.publications.map((p) => (
          <li key={p.title}>
            <span>{p.title}</span>
            <span className="muted small">{p.authors}</span>
            {p.doi ? (
              <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="mono small">
                doi:{p.doi}
              </a>
            ) : (
              <span className="muted small">no DOI in PSI</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

const DOC_KIND: Record<string, string> = { other_pdf: "PDF", other_docx: "Word", other_xlsx: "Excel", other_csv: "CSV" };

function DocsSec({ data }: { data: Dashboard }) {
  return (
    <section className="sfl-sec" id="documents" aria-labelledby="sfl-docs">
      <h2 id="sfl-docs" className="h-section">Documents</h2>
      <p className="lede">Study-wide files in NASA PSI (PSI-99). Light documents are also kept in our snapshot; camera image archives are not used.</p>
      <ul className="sfr-files">
        {data.documents.map((f) => (
          <li key={f.name}>
            <span>{f.name}</span>
            <span className="muted small">
              {f.category} · {DOC_KIND[f.kind] ?? f.kind}
            </span>
            <span className="mono small">{f.mb} MB</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeamSec({ data }: { data: Dashboard }) {
  const { about } = data;
  return (
    <section className="sfl-sec" id="team" aria-labelledby="sfl-team">
      <h2 id="sfl-team" className="h-section">Objective and team</h2>
      <h3>Objective</h3>
      <p>{about.objective}</p>
      <h3>Hypothesis</h3>
      <p>{about.hypothesis}</p>
      <h3>Hardware</h3>
      <p>
        {about.hardware} · {about.flight_program} · {about.start_date} – {about.end_date}
      </p>
      <h3>Team</h3>
      <ul className="sf-team">
        {about.contacts.map((c) => (
          <li key={c.name}>
            {c.name} <span className="muted">· {c.affiliation}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
