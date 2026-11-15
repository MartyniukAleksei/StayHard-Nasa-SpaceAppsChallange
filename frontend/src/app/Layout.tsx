import { NavLink, Outlet } from "react-router";
import { useOverview } from "@/features/study-overview";
import { useHealth } from "@/shared/api/health";
import "./shell.css";

const SOON = ["Tests", "Compare", "Library"];

export function Layout() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

function Header() {
  return (
    <header className="top">
      <div className="top-row">
        <NavLink to="/studies/flex" className="brand">
          <svg width="24" height="24" viewBox="0 0 4 4" aria-hidden="true" fill="currentColor">
            <rect x="0" y="0" width="2" height="2" />
            <rect x="2" y="2" width="1" height="1" />
            <rect x="3" y="1" width="1" height="1" />
            <rect x="1" y="3" width="1" height="1" />
          </svg>
          <span className="h-brand">Flame in Freefall</span>
        </NavLink>
        <span className="tag on">FLEX</span>
        <nav aria-label="Study sections" className="top-nav">
          <NavLink to="/studies/flex" end>
            Overview
          </NavLink>
          {SOON.map((s) => (
            <span key={s} className="soon" aria-disabled="true" title="Coming soon">
              {s}
            </span>
          ))}
        </nav>
        <label className="search">
          <span className="sr-only">Ask the agent</span>
          <input
            type="search"
            disabled
            placeholder="Ask the agent — coming soon"
          />
        </label>
      </div>
    </header>
  );
}

function Footer() {
  const overview = useOverview();
  const health = useHealth();
  const doi = overview.data?.about.doi;
  const api = health.isError ? "API unreachable" : health.data ? `API ${health.data.status}` : "API …";
  return (
    <footer className="foot">
      <div className="foot-row">
      <span>
        Data: NASA Physical Sciences Informatics, FLEX (PSI-69), CC0
        {doi && (
          <>
            {" · "}
            <a href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">
              doi:{doi}
            </a>
          </>
        )}
      </span>
      <span>Font IBM VGA 8×16: Oldschool PC Font Pack, © VileR, CC BY-SA 4.0</span>
      <span className="mono">{api}</span>
      </div>
    </footer>
  );
}
