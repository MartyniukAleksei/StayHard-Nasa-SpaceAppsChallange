import { useMemo } from "react";
import { Placeholder } from "@/shared/ui/Placeholder";
import { useRegimeMap } from "../api";
import { CALLOUTS_MAP, CALLOUTS_PAUSE, PITFALLS, STAGES } from "../content";
import { TEST_ID } from "../frames";
import { citedIds } from "../lib/cited";
import { SOURCES } from "../sources";
import { CoolFlamePause } from "./CoolFlamePause";
import { RegimeMap } from "./RegimeMap";
import "./cfig-cool.css";

/** ACME CFI-G (PSI-159) page: the dark pause with real frames, then the regime map of all tests. */
export function CfigStudy() {
  const q = useRegimeMap();

  const ids = useMemo(
    () => [
      ...new Set(
        citedIds([
          ...STAGES.map((s) => s.text),
          ...CALLOUTS_PAUSE.flatMap((c) => c.paragraphs),
          ...CALLOUTS_MAP.flatMap((c) => c.paragraphs),
          ...PITFALLS.map((p) => p.text),
          "[[kim2023]] [[stocker2022]]",
        ]),
      ),
    ],
    [],
  );

  if (q.isPending) return <div className="wrap cf"><p className="mono small">Loading …</p></div>;
  if (q.isError)
    return (
      <div className="wrap cf">
        <p className="placeholder" role="alert">
          Could not load PSI-159 ({q.error.message}). The study snapshot must be in the database: unpack data-psi-studies-v1
          and run build_db (docs/data/psi-studies.md).
        </p>
      </div>
    );

  const { about, facts, tests } = q.data;
  const test = tests.find((t) => t.test_id === TEST_ID);

  return (
    <div className="wrap cf">
      <header className="cf-head">
        <p className="cf-kicker">
          {about.accession} · {about.acronym}
        </p>
        <h1 className="h-display">Cool diffusion flames on a spherical burner</h1>
        <p className="lede">{about.title}. Gas flames (ethane, propane, n-butane) on a porous spherical burner in a closed chamber on the ISS.</p>
        <dl className="stats cf-stats">
          <div className="stat"><b>{facts.n_tests}</b><span>tests in the table</span></div>
          <div className="stat"><b>{facts.n_normal}</b><span>normal flames</span></div>
          <div className="stat"><b>{facts.n_inverse}</b><span>inverse flames</span></div>
          <div className="stat"><b>{facts.n_cool_flame_noted}</b><span>with a cool flame noted <span className="tag">derived</span></span></div>
        </dl>
      </header>

      <CoolFlamePause test={test} about={about} />
      <RegimeMap tests={tests} facts={facts} about={about} />

      <section className="band cf-band" id="sources" aria-labelledby="cf-src-title">
        <h2 id="cf-src-title" className="h-section">Sources</h2>
        <ol className="cf-sources">
          {ids.map((id) => {
            const s = SOURCES[id];
            if (!s) return null;
            return (
              <li key={id} id={`src-${id}`}>
                {s.citation}{" "}
                {s.href && (
                  <a href={s.href} target="_blank" rel="noreferrer">
                    {s.href.replace("https://", "")}
                  </a>
                )}
                {s.todo && <Placeholder>{s.todo}</Placeholder>}
              </li>
            );
          })}
        </ol>
        <p className="small muted">
          Data: {about.citation}, {about.license}. Test table and frame metadata are NASA’s; counts and checks on this page are computed from the table and marked derived.
        </p>
      </section>
    </div>
  );
}
