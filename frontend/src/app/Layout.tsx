import { Link, NavLink, Outlet, useLocation } from "react-router";
import { AgentLauncher, AgentPanel, AgentProvider } from "@/features/agent";
import { useSameROverview } from "@/features/same-r";
import { useOverview } from "@/features/study-overview";
import { useHealth } from "@/shared/api/health";
import "./shell.css";

const FLEX_NAV = [
  { to: "/studies/flex", label: "Overview", end: true },
  { to: "/studies/flex/tests", label: "Tests", end: false },
  { to: "/studies/flex/compare", label: "Compare", end: true },
  { to: "/studies/flex/library", label: "Library", end: true },
];

// Study sections in the header: tag + nav, shown while the path is inside the study.
const STUDIES = [
  { prefix: "/studies/flex", tag: "FLEX", nav: FLEX_NAV },
  {
    prefix: "/studies/same-r",
    tag: "SAME-R",
    nav: [
      { to: "/studies/same-r", label: "Overview", end: true },
      { to: "/studies/same-r/tests", label: "Tests", end: false },
      { to: "/studies/same-r/compare", label: "Compare", end: true },
      { to: "/studies/same-r/library", label: "Library", end: true },
    ],
  },
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
  const study = STUDIES.find((s) => path.startsWith(s.prefix));
  return (
    <header className="top">
      <div className="top-row">
        <Link to="/" className="brand">
          {/* pixel fire: two tongues and an inner flame */}
          <svg width="24" height="24" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" shapeRendering="crispEdges">
            <path d="M6 0h1v1H6zM6 1h2v1H6zM5 2h3v1H5zM5 3h3v1H5zM12 3h1v1H12zM4 4h5v1H4zM12 4h2v1H12zM4 5h5v1H4zM11 5h3v1H11zM3 6h7v1H3zM11 6h3v1H11zM3 7h11v1H3zM2 8h6v1H2zM9 8h5v1H9zM2 9h5v1H2zM10 9h4v1H10zM1 10h5v1H1zM11 10h4v1H11zM1 11h4v1H1zM7 11h2v1H7zM11 11h4v1H11zM1 12h4v1H1zM6 12h4v1H6zM11 12h4v1H11zM1 13h4v1H1zM6 13h4v1H6zM11 13h3v1H11zM2 14h3v1H2zM7 14h2v1H7zM11 14h3v1H11zM3 15h10v1H3z" />
          </svg>
          <span className="h-brand">StayHard</span>
        </Link>
        {study && (
          <nav aria-label={`${study.tag} sections`} className="top-nav">
            {study.nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
        <span className="top-actions">
          <AgentLauncher />
        </span>
      </div>
    </header>
  );
}

function Footer() {
  const sameR = useLocation().pathname.startsWith("/studies/same-r");
  const overview = useOverview();
  const sameROverview = useSameROverview(sameR);
  const health = useHealth();
  const doi = sameR ? sameROverview.data?.doi : overview.data?.about.doi;
  const api = health.isError ? "API unreachable" : health.data ? `API ${health.data.status}` : "API …";
  return (
    <footer className="foot">
      <div className="foot-row">
      <span>
        Data: NASA Physical Sciences Informatics, {sameR ? "SAME-R (PSI-101)" : "FLEX (PSI-69)"}, CC0
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
