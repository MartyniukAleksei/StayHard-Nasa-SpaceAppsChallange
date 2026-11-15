import { DropletReplay } from "@/features/replay";
import { DEMO_TEST, HERO_QUESTION, HERO_VARIED } from "../content";
import type { Facts } from "../types";

const SUBSCRIPT: Record<string, string> = { "2": "₂", "6": "₆" };
/** "CO2" → "CO₂", "N2" → "N₂" (display only). */
const chem = (s: string) => s.replace(/([A-Z][a-z]?)(\d)/g, (_, el, n) => el + (SUBSCRIPT[n] ?? n));

export function Hero({ facts }: { facts: Facts }) {
  const years = `${facts.first_year}–${facts.last_year}`;
  return (
    <section className="band ov-hero-band" aria-labelledby="hero-title">
      <div className="wrap ov-hero">
        <div className="ov-hero-text">
          <p className="ov-kicker mono">FLEX · Flame Extinguishment Experiment · ISS</p>
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
        </div>
        <div className="ov-hero-replay">
          <DropletReplay testNo={DEMO_TEST} />
        </div>
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
