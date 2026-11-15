import { useMemo } from "react";
import { Link } from "react-router";
import { useSameROverview, useSameRTests } from "../api";
import { PTRAK_LIMIT, SameR3D } from "@/features/same-r-3d";
import { HERO_LEDE, HERO_QUESTION } from "../content";
import { testHref, TESTS_PATH } from "../lib/compare";
import { readFirst, type Pick } from "../lib/picks";
import { groupTests, materials, type TestGroup } from "../lib/tests";
import type { Overview } from "../types";
import { LoadError, Loading } from "./Common";
import { Findings, How, References, TestCards } from "./OverviewParts";
import { IssPhotos } from "./Photos";
import "./same-r.css";

/** SAME-R overview, in the FLEX order (.claude/skills/study-overview-page/SKILL.md). */
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
      {picks[0] && <Example pick={picks[0]} />}
      <TestCards picks={picks} />
      <How photos={<IssPhotos bursts />} />
      <Findings groups={groups} />
      <BrowseTests />
      <References o={overview.data} picks={picks} />
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
            Browse all tests →
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

/** Link to the tests, at the end of the story (as on the FLEX overview). */
function BrowseTests() {
  return (
    <section className="band" aria-label="All tests">
      <div className="wrap sr-browse">
        <p className="lede">Every test, filterable by material, heater level and what was measured.</p>
        <Link className="btn" to={TESTS_PATH}>
          Browse all tests →
        </Link>
      </div>
    </section>
  );
}
