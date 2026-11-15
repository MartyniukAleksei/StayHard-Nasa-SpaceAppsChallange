import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useOverview } from "@/features/study-overview";
import { useHealth } from "@/shared/api/health";
import "./shell.css";

const FLEX_NAV = [
  { to: "/studies/flex", label: "Overview", end: true },
  { to: "/studies/flex/tests", label: "Tests", end: false },
  { to: "/studies/flex/compare", label: "Compare", end: true },
  { to: "/studies/flex/library", label: "Library", end: true },
];

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
  const inFlex = useLocation().pathname.startsWith("/studies/flex");
  return (
    <header className="top">
      <div className="top-row">
        <Link to="/" className="brand">
          <svg width="24" height="24" viewBox="0 0 4 4" aria-hidden="true" fill="currentColor">
            <rect x="0" y="0" width="2" height="2" />
            <rect x="2" y="2" width="1" height="1" />
            <rect x="3" y="1" width="1" height="1" />
            <rect x="1" y="3" width="1" height="1" />
          </svg>
          <span className="h-brand">Flame in Freefall</span>
        </Link>
        {inFlex && (
          <>
            <Link to="/" className="tag on" title="Choose another study">
              FLEX
            </Link>
            <nav aria-label="FLEX sections" className="top-nav">
              {FLEX_NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </>
        )}
        <label className="search">
          <span className="sr-only">Ask the agent</span>
          <input type="search" disabled placeholder="Ask the agent — coming soon" />
        </label>
        <button type="button" className="btn ghost" disabled title="Lab cart — coming soon">
          Cart · 0
        </button>
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
