import { useMemo } from "react";
import { Link } from "react-router";
import { useSameROverview, useSameRTests } from "../api";
import { HERO_LEDE, HERO_QUESTION, TRAPS, WHY } from "../content";
import { LIBRARY_PATH, TESTS_PATH } from "../lib/compare";
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
