import { useEffect, useRef, useState } from "react";
import { StudyCards } from "./StudyCards";
import { useSky } from "./Sky";
import "./landing.css";

/** Landing `/`: ASCII sky + general hero for all tracks, then the study picker. */
export function Landing() {
  const sky = useRef<HTMLCanvasElement>(null);
  const cosmos = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  useSky(sky, cosmos, text);
  // the "choose a study" cue hides once the user scrolls, and comes back at the very top
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 0);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="land-page">
      <canvas ref={cosmos} className="land-cosmos" aria-hidden="true" />
      <section className="land" aria-labelledby="land-title">
        <canvas ref={sky} className="land-sky" role="img" aria-label="ASCII animation: a satellite orbiting the Moon" />
        <div className="land-txt">
          <div className="land-in" ref={text}>
            <p className="muted mono small">NASA Space Apps 2026 · Flame in Freefall</p>
            <h1 id="land-title">Fire without gravity</h1>
            <p className="land-sub">
              Flames, smoke and smoke detectors aboard the International Space Station. NASA
              combustion and fire-safety experiments: watch, search, compare, and take the data
              for your lab report.
            </p>
            <div className="land-cta">
              <a className="btn" href="#studies">
                Start
              </a>
            </div>
          </div>
        </div>
        <a className={scrolled ? "land-down mono gone" : "land-down mono"} href="#studies" aria-hidden={scrolled || undefined} tabIndex={scrolled ? -1 : undefined}>
          <i aria-hidden="true">v</i>choose a study
        </a>
      </section>
      <StudyCards />
    </div>
  );
}
