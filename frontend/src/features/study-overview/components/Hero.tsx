import { chem } from "@/shared/lib/format";
import { HERO_QUESTION, HERO_VARIED } from "../content";
import type { About, Facts } from "../types";

/** A: the study question, one line of context, key numbers and a meta row (layout 1A). */
export function Hero({ about, facts }: { about: About; facts: Facts }) {
  const years = `${facts.first_year}–${facts.last_year}`;
  return (
    <section className="band" aria-labelledby="hero-title">
      <div className="wrap ov-hero">
        <p className="ov-kicker mono">
          {about.acronym} · {about.title} · ISS
        </p>
        <h1 id="hero-title" className="h-display">{HERO_QUESTION}</h1>
        <p className="lede">
          {facts.n_tests} tests: a fuel droplet was ignited aboard the ISS while the surrounding
          atmosphere was varied ({HERO_VARIED}).
        </p>
        <div className="stats">
          <Stat value={facts.n_tests} label="tests" />
          <Stat value={facts.fuels.length} label={facts.fuels.join(" · ")} />
          <Stat value={facts.diluents.length} label={`diluents: ${facts.diluents.map(chem).join(", ")}`} />
          <Stat value={years} label="on the ISS" />
        </div>
        <p className="ov-meta mono small">
          {about.acronym} · {about.accession} · {about.flight_program} · {years} · {facts.n_tests} tests ·{" "}
          <a href={`https://doi.org/${about.doi}`} target="_blank" rel="noreferrer">
            doi:{about.doi}
          </a>
        </p>
      </div>
    </section>
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
