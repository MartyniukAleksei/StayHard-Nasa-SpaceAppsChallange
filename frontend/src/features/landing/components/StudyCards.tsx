import { Link } from "react-router";
import { FlameMini } from "./FlameMini";
import { useStudies } from "../api";
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
          Microgravity combustion datasets from NASA Physical Sciences Informatics. FLEX, SAME-R
          and SAFFIRE-II are open now; the others are next.
        </p>
        {isPending && <p className="muted mono">Loading studies…</p>}
        {isError && (
          <p className="placeholder" role="alert">
            Could not load the study list ({error.message}).
          </p>
        )}
        {data && (
          <ul className="land-cards">
            {data.map((s) => (s.status === "active" && s.route ? <Active key={s.accession} s={s} route={s.route} /> : <Soon key={s.accession} s={s} />))}
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

function Active({ s, route }: { s: StudyCard; route: string }) {
  const f = s.facts;
  return (
    <li className="land-card on">
      <Link to={route} className="land-card-link">
        <Passport s={s} />
        {f && (
          <div className="land-facts-row">
          <div className="stats land-facts">
            <div className="stat">
              <b>{f.n_tests}</b>
              <span>tests</span>
            </div>
            <div className="stat">
              <b>{f.fuels.length}</b>
              <span>fuels</span>
            </div>
            <div className="stat">
              <b>
                {f.first_year}–{f.last_year}
              </b>
              <span>on the ISS</span>
            </div>
          </div>
          <FlameMini caption="a fuel droplet burning inside a spherical flame" />
          </div>
        )}
        <span className="btn">Open {s.acronym}</span>
      </Link>
    </li>
  );
}

function Soon({ s }: { s: StudyCard }) {
  return (
    <li className="land-card soon">
      <Passport s={s} />
      <p className="mono small">
        <span className="tag">coming soon</span>{" "}
        <a className="muted" href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer">
          doi:{s.doi}
        </a>
      </p>
    </li>
  );
}
