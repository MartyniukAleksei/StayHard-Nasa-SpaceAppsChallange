import { Link } from "react-router";
import { Bass2Apparatus3D } from "@/features/bass2-apparatus-3d";
import { CopyButton } from "@/shared/ui/CopyButton";
import { apiHref, useBass2Overview, useBass2Tests } from "../api";
import {
  CREW_TITLE,
  HERO_LEDE,
  HERO_QUESTION,
  REPORT_CITATION,
  TEAMS,
  TRAPS,
  U_MAP_TEXT,
  U_MAP_TITLE,
  WHY_TEXT,
  WHY_TITLE,
} from "../content";
import { firstNumber } from "../lib/outcomes";
import type { Facts, Finding, Overview, TestRow } from "../types";
import { OxygenStrip, type RefLine } from "./OxygenStrip";
import "./bass2.css";


/** BASS-II overview: one vertical story (layout 1A, like FLEX). */
export function Bass2Overview() {
  const ov = useBass2Overview();
  const tests = useBass2Tests();

  if (ov.isPending) {
    return (
      <div className="wrap band">
        <p className="muted mono">Loading BASS-II…</p>
      </div>
    );
  }
  if (ov.isError) {
    return (
      <div className="wrap band">
        <p className="placeholder" role="alert">
          Could not load BASS-II data ({ov.error.message}). Is the backend running and the
          database built with the bass2 snapshot?
        </p>
      </div>
    );
  }
  const d = ov.data;
  const by = (g: Finding["group"]) => d.findings.filter((f) => f.group === g);
  return (
    <div className="b2">
      <Hero ov={d} />
      <EarthVsSpace findings={by("earth_vs_space")} />
      <section className="band" aria-labelledby="b2-3d-title">
        <div className="wrap">
          <h2 id="b2-3d-title" className="h-section">Inside the flow duct</h2>
          <p className="lede">
            A schematic of the BASS-II wind tunnel. Pick a sample, move the flow and oxygen, and
            see which way the flame goes. Shapes are schematic; the limits come from the report.
          </p>
          <Bass2Apparatus3D />
        </div>
      </section>
      <UMap findings={d.findings} />
      <AllTests tests={tests.data} facts={d.facts} findings={d.findings} isError={tests.isError} />
      <Teams facts={d.facts} />
      <FindingList id="limits" title="At the limits" findings={[...by("flammability"), ...by("extinction")].filter((f) => f.id !== "boundary_eq")} />
      <FindingList id="products" title="Smoke, CO and heat" findings={by("products")} />
      <FindingList id="crew" title={CREW_TITLE} findings={by("crew")} />
      <Traps tests={tests.data} facts={d.facts} />
      <Cite ov={d} />
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function Hero({ ov }: { ov: Overview }) {
  const f = ov.facts;
  const years = `${f.first_year}–${f.last_year}`;
  return (
    <section className="band" aria-labelledby="b2-hero-title">
      <div className="wrap b2-hero">
        <p className="b2-kicker mono">
          {ov.acronym} · {ov.title} · ISS
        </p>
        <h1 id="b2-hero-title" className="h-display">{HERO_QUESTION}</h1>
        <p className="lede">{HERO_LEDE}</p>
        <div className="stats">
          <Stat value={f.n_tests} label="burns on the ISS" />
          <Stat value={f.by_material.length} label="sample materials" />
          <Stat value={f.n_pi} label="research teams" />
          <Stat value={`${f.o2_min_pct}–${f.o2_max_pct}%`} label="oxygen at ignition" />
        </div>
        <div className="b2-cta">
          <Link className="btn" to="/studies/bass2/tests">
            Browse all tests →
          </Link>
        </div>
        <p className="b2-meta mono small">
          {ov.acronym} · {ov.accession} · {ov.hardware} · {years} ·{" "}
          <a href={`https://doi.org/${ov.doi}`} target="_blank" rel="noreferrer">
            doi:{ov.doi}
          </a>
        </p>
      </div>
    </section>
  );
}

function SourceLink({ f }: { f: Finding }) {
  return (
    <a className="b2-src mono small" href={apiHref(f.source.url)} target="_blank" rel="noreferrer">
      NASA/TM-20210011385, p. {f.page}
      {f.figure ? ` · ${f.figure}` : ""} ↗
    </a>
  );
}

function EarthVsSpace({ findings }: { findings: Finding[] }) {
  return (
    <section className="band" aria-labelledby="b2-why-title">
      <div className="wrap">
        <h2 id="b2-why-title" className="h-section">{WHY_TITLE}</h2>
        <p className="lede">{WHY_TEXT}</p>
        <ul className="cells b2-versus">
          {findings.map((f) => (
            <li key={f.id} className="cell">
              <h3>{f.title}</h3>
              <div className="b2-vs">
                <div className="stat">
                  <b>{f.value}</b>
                  <span>in microgravity</span>
                </div>
                {f.earth_value && (
                  <div className="stat b2-earth">
                    <b>{f.earth_value}</b>
                    <span>on Earth</span>
                  </div>
                )}
              </div>
              <blockquote className="b2-quote">“{f.text}”</blockquote>
              <SourceLink f={f} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function UMap({ findings }: { findings: Finding[] }) {
  const eq = findings.find((f) => f.id === "boundary_eq");
  return (
    <section className="band" aria-labelledby="b2-u-title">
      <div className="wrap b2-narrow">
        <h2 id="b2-u-title" className="h-section">{U_MAP_TITLE}</h2>
        {U_MAP_TEXT.map((p) => (
          <p key={p}>{p}</p>
        ))}
        {eq && (
          <p className="b2-eq">
            <code className="mono">{eq.value}</code> <SourceLink f={eq} />
          </p>
        )}
      </div>
    </section>
  );
}

function AllTests({
  tests,
  facts,
  findings,
  isError,
}: {
  tests: TestRow[] | undefined;
  facts: Facts;
  findings: Finding[];
  isError: boolean;
}) {
  const space = findings.find((f) => f.id === "rod_min_o2");
  const refs: RefLine[] = [];
  const s = firstNumber(space?.value);
  const e = firstNumber(space?.earth_value);
  if (s != null) refs.push({ x: s, label: `${s}% rods burn in space (p. ${space?.page})`, tone: "flame" });
  if (e != null) refs.push({ x: e, label: `${e}% Earth upward-spread limit (p. ${space?.page})`, tone: "ash" });
  return (
    <section className="band" aria-labelledby="b2-all-title">
      <div className="wrap">
        <h2 id="b2-all-title" className="h-section">
          Every burn by oxygen <span className="tag">derived</span>
        </h2>
        <p className="lede">
          Each mark is one test at its starting oxygen level. Rows are the flow geometry and the
          glyph is how the test ended, read from the researchers' notes in the report. Click a mark
          to open the test.
        </p>
        {isError && (
          <p className="placeholder" role="alert">
            Could not load the test list.
          </p>
        )}
        {tests && <OxygenStrip tests={tests} refs={refs} />}
        <p className="small muted">
          {facts.n_logged} of {facts.n_tests} tests are in the report log; the others have no
          outcome. Outcome and flow geometry: Appendix A, NASA/TM-20210011385 (p. 103–113).
        </p>
      </div>
    </section>
  );
}

function Teams({ facts }: { facts: Facts }) {
  const count = (pi: string) => facts.by_pi.find((p) => p.key === pi)?.count;
  return (
    <section className="band" aria-labelledby="b2-teams-title">
      <div className="wrap">
        <h2 id="b2-teams-title" className="h-section">Six teams, one wind tunnel</h2>
        <ul className="cells b2-teams">
          {TEAMS.map((t) => (
            <li key={t.pi} className="cell">
              <p className="mono small muted">
                {t.letter} · {t.pi} · {t.affiliation}
              </p>
              <h3>{t.sample}</h3>
              <p className="small muted">{t.geometry}</p>
              <p>{t.takeaway}</p>
              <p className="mono small">
                <Link to={`/studies/bass2/tests?pi=${encodeURIComponent(t.pi)}`}>
                  {count(t.pi) ?? "—"} tests →
                </Link>{" "}
                <span className="muted">· report p. {t.page}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FindingList({ id, title, findings }: { id: string; title: string; findings: Finding[] }) {
  if (!findings.length) return null;
  return (
    <section className="band" aria-labelledby={`b2-${id}-title`} id={id}>
      <div className="wrap">
        <h2 id={`b2-${id}-title`} className="h-section">{title}</h2>
        <ul className="b2-findings">
          {findings.map((f) => (
            <li key={f.id}>
              <h3>
                {f.title}
                {f.value !== "—" && <span className="b2-val mono"> {f.value}</span>}
              </h3>
              <blockquote className="b2-quote">“{f.text}”</blockquote>
              <SourceLink f={f} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Traps({ tests, facts }: { tests: TestRow[] | undefined; facts: Facts }) {
  const suspect = tests?.filter((t) => t.o2_final_suspect).length;
  const overRange = tests?.filter((t) => t.co_over_range).length;
  return (
    <section className="band" aria-labelledby="b2-traps-title">
      <div className="wrap">
        <h2 id="b2-traps-title" className="h-section">Read the data with care</h2>
        <ul className="cells b2-traps">
          {TRAPS.map((t) => (
            <li key={t.title} className="cell">
              <h3>{t.title}</h3>
              <p>{t.text}</p>
            </li>
          ))}
          <li className="cell">
            <h3>Flags in the table</h3>
            <p>
              Final O₂ outside a physical range: <b className="mono">{suspect ?? "…"}</b> tests.
              CO over the sensor range: <b className="mono">{overRange ?? "…"}</b> tests. Tests
              without a report log entry: <b className="mono">{facts.n_tests - facts.n_logged}</b>.
            </p>
          </li>
        </ul>
      </div>
    </section>
  );
}

function Cite({ ov }: { ov: Overview }) {
  return (
    <section className="band" aria-labelledby="b2-cite-title">
      <div className="wrap">
        <h2 id="b2-cite-title" className="h-section">Cite the data</h2>
        <div className="b2-cite">
          <p>{ov.citation}</p>
          <CopyButton text={ov.citation} label="Copy citation" />
        </div>
        <div className="b2-cite">
          <p>{REPORT_CITATION}</p>
          <CopyButton text={REPORT_CITATION} label="Copy report" />
        </div>
        <p className="small muted">
          {ov.license_name}. Data: NASA Physical Sciences Informatics, {ov.accession}.
        </p>
      </div>
    </section>
  );
}
