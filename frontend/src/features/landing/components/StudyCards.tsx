import { Link } from "react-router";
import { FlameMini } from "./FlameMini";
import { useStudies } from "../api";
import { MINI } from "../lib/miniScenes";
import type { StudyCard } from "../types";

const EXCERPT = 180;

/** "The FLEX (Flame Extinguishment Experiment) investigation aims…" → "FLEX aims…". */
const plainName = (s: string) => s.replace(/^The\s+([A-Z][\w-]*)\s*(\([^)]*\))?\s+investigation\b/, "$1");

const excerpt = (s: string) => {
  const flat = plainName(s.replace(/\s+/g, " ").trim());
  return flat.length > EXCERPT ? `${flat.slice(0, EXCERPT).replace(/\s+\S*$/, "")}…` : flat;
};

/** Study picker: active studies link to their pages; the rest show their PSI passport. */
export function StudyCards() {
  const { data, isPending, isError, error } = useStudies();
  return (
    <section id="studies" className="band land-studies" aria-labelledby="studies-title">
      <div className="wrap">
        <h2 id="studies-title" className="sr-only">Choose a study</h2>
        <p className="lede">
          Microgravity combustion datasets from NASA Physical Sciences Informatics.
        </p>
        {isPending && <p className="muted mono">Loading studies…</p>}
        {isError && (
          <p className="placeholder" role="alert">
            Could not load the study list ({error.message}).
          </p>
        )}
        {data && (
          <ul className="land-cards">
            {data.map((s) => s.status === "active" && s.route && <Active key={s.accession} s={s} route={s.route} />)}
          </ul>
        )}
      </div>
    </section>
  );
}

function Passport({ s }: { s: StudyCard }) {
  return (
    <>
      <p className="mono small muted">
        {s.accession} · {s.sub_research_area}
      </p>
      <h3>
        {s.acronym} <span className="muted">· {s.title}</span>
      </h3>
      <p className="land-obj">{excerpt(s.objective)}</p>
    </>
  );
}

// what "fuels" and the year range mean on each card (FLEX burns fuels; the rest burn or heat materials)
const MATERIALS = "materials";

function Active({ s, route }: { s: StudyCard; route: string }) {
  const f = s.facts;
  const mini = MINI[s.acronym];
  const what = s.acronym === "FLEX" ? "fuels" : MATERIALS;
  return (
    <li className="land-card on">
      <Link to={route} className="land-card-link">
        <Passport s={s} />
        {f && (
          <p className="mono land-nums">
            {f.n_tests} {s.acronym === "SAFFIRE-II" ? "samples" : "tests"} · {f.fuels.length} {what} ·{" "}
            {f.first_year === f.last_year ? f.first_year : `${f.first_year}–${f.last_year}`}
          </p>
        )}
      </Link>
      <Link to={route} className="btn land-open">
        Open {s.acronym}
      </Link>
      {mini && <FlameMini scene={mini.scene} caption={mini.caption} />}
    </li>
  );
}
