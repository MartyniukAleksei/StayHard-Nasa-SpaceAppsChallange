import { Link, NavLink, Outlet, useLocation } from "react-router";
import { AgentPanel, AgentProvider, AgentSearch } from "@/features/agent";
import { useBass2Overview } from "@/features/bass2";
import { useOverview } from "@/features/study-overview";
import { useHealth } from "@/shared/api/health";
import "./shell.css";

const FLEX_NAV = [
  { to: "/studies/flex", label: "Overview", end: true },
  { to: "/studies/flex/tests", label: "Tests", end: false },
  { to: "/studies/flex/compare", label: "Compare", end: true },
  { to: "/studies/flex/library", label: "Library", end: true },
];

const BASS2_NAV = [
  { to: "/studies/bass2", label: "Overview", end: true },
  { to: "/studies/bass2/tests", label: "Tests", end: false },
];

export function Layout() {
  return (
    <AgentProvider>
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <AgentPanel />
    </AgentProvider>
  );
}

function Header() {
  const path = useLocation().pathname;
  const nav = path.startsWith("/studies/flex") ? FLEX_NAV : path.startsWith("/studies/bass2") ? BASS2_NAV : null;
  const navLabel = path.startsWith("/studies/bass2") ? "BASS-II sections" : "FLEX sections";
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
        {nav && (
          <nav aria-label={navLabel} className="top-nav">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
        <AgentSearch />
        <button type="button" className="btn ghost" disabled title="Lab cart — coming soon">
          Cart · 0
        </button>
      </div>
    </header>
  );
}

function Footer() {
  const inBass2 = useLocation().pathname.startsWith("/studies/bass2");
  const overview = useOverview();
  const bass2 = useBass2Overview();
  const health = useHealth();
  const doi = inBass2 ? bass2.data?.doi : overview.data?.about.doi;
  const dataset = inBass2 ? "BASS-II (PSI-25)" : "FLEX (PSI-69)";
  const api = health.isError ? "API unreachable" : health.data ? `API ${health.data.status}` : "API …";
  return (
    <footer className="foot">
      <div className="foot-row">
      <span>
        Data: NASA Physical Sciences Informatics, {dataset}, CC0
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
