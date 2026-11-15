import { useMemo } from "react";
import { Link } from "react-router";
import { useSameROverview, useSameRTests } from "../api";
import { PTRAK_LIMIT, SameR3D } from "@/features/same-r-3d";
import { HERO_LEDE, HERO_QUESTION, HOW, TRAPS, WHY } from "../content";
import { LIBRARY_PATH, testHref, TESTS_PATH } from "../lib/compare";
import { readFirst, type Pick } from "../lib/picks";
import { groupTests, materials, type TestGroup } from "../lib/tests";
import type { Overview } from "../types";
import { Cite, LoadError, Loading } from "./Common";
import { IssPhotos } from "./Photos";
import "./same-r.css";

/** SAME-R overview: the question, key numbers, the hardware on the ISS, why it matters, how to cite. */
export function SameROverview() {
  const overview = useSameROverview();
  const tests = useSameRTests();
  const groups = useMemo(() => groupTests(tests.data?.tests ?? []), [tests.data]);

  const picks = useMemo(() => readFirst(groups, PTRAK_LIMIT), [groups]);
  if (overview.isPending || tests.isPending) return <Loading what="SAME-R" />;
  if (overview.isError || tests.isError) return <LoadError message={(overview.error ?? tests.error)?.message} />;
  return (
    <div className="sr">
      <Hero o={overview.data} groups={groups} />
      <section className="band" aria-labelledby="sr-iss">
        <div className="wrap">
          <h2 id="sr-iss" className="h-section">On the ISS</h2>
          <IssPhotos bursts />
        </div>
      </section>
      <How />
      <ReadFirst picks={picks} />
      {picks[0] && <Example pick={picks[0]} />}
      <Why />
      <Cite o={overview.data} />
    </div>
  );
}

function Hero({ o, groups }: { o: Overview; groups: TestGroup[] }) {
  const mats = materials(groups);
  const aged = groups.filter((g) => g.aged).length;
  return (
    <section className="band" aria-labelledby="sr-title">
      <div className="wrap sr-hero">
        <p className="sr-kicker mono">
          {o.acronym} · {o.title} · ISS
        </p>
        <h1 id="sr-title" className="h-display">{HERO_QUESTION}</h1>
        <p className="lede">{HERO_LEDE}</p>
        <div className="stats">
          <Stat value={groups.length} label="tests: one heated sample each" />
          <Stat value={mats.length} label={`materials: ${mats.map(([m]) => m).join(", ")}`} />
          <Stat value={aged} label="tests where the smoke was measured again after aging" />
        </div>
        <div className="sr-actions">
          <Link className="btn" to={TESTS_PATH}>
            Browse all tests
          </Link>
          <Link className="btn ghost" to={LIBRARY_PATH}>
            Documents and photos
          </Link>
        </div>
        <p className="sr-meta mono small">
          {o.acronym} · {o.accession} · {o.flight_program} · {o.start_date} – {o.end_date}
          {o.doi && (
            <>
              {" · "}
              <a href={`https://doi.org/${o.doi}`} target="_blank" rel="noreferrer">
                doi:{o.doi}
              </a>
            </>
          )}
        </p>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function Why() {
  return (
    <section className="band" aria-labelledby="sr-why">
      <div className="wrap">
        <h2 id="sr-why" className="h-section">Why it matters</h2>
        <ul className="cells sr-why">
          {WHY.map((w) => (
            <li key={w.title} className="cell">
              <h3>{w.title}</h3>
              <p>{w.text}</p>
              <p className="small muted">{w.cite}</p>
            </li>
          ))}
        </ul>
        <h3 className="sr-sub">Read the numbers carefully</h3>
        <ul className="sr-traps">
          {TRAPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function How() {
  return (
    <section className="band" aria-labelledby="sr-how">
      <div className="wrap">
        <h2 id="sr-how" className="h-section">How it worked</h2>
        <ol className="cells sr-how">
          {HOW.map((h, i) => (
            <li key={h.title} className="cell">
              <span className="mono small muted">{String(i + 1).padStart(2, "0")}</span>
              <h3>{h.title}</h3>
              <p>{h.text}</p>
              <p className="small muted">{h.cite}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ReadFirst({ picks }: { picks: Pick[] }) {
  if (!picks.length) return null;
  return (
    <section className="band" aria-labelledby="sr-first">
      <div className="wrap">
        <h2 id="sr-first" className="h-section">
          Tests to read first <span className="tag">derived</span>
        </h2>
        <p className="lede">For each thing worth seeing, the first test with telemetry that shows it.</p>
        <ul className="cells sr-first">
          {picks.map((p) => (
            <li key={p.id} className="cell">
              <h3>{p.title}</h3>
              <p>{p.why}</p>
              <Link className="btn ghost" to={testHref(p.g.test_no)}>
                Test #{p.g.main.test_id} · {p.g.main.material}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Example({ pick }: { pick: Pick }) {
  return (
    <section className="band" aria-labelledby="sr-example">
      <div className="wrap">
        <h2 id="sr-example" className="h-section">See a test in 3D</h2>
        <p className="lede">
          Test #{pick.g.main.test_id}, {pick.g.main.material}. <Link to={testHref(pick.g.test_no)}>Open the full test →</Link>
        </p>
        <SameR3D testNo={pick.g.test_no} />
      </div>
    </section>
  );
}
