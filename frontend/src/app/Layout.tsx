import { Link, NavLink, Outlet, useLocation } from "react-router";
import { AgentLauncher, AgentPanel, AgentProvider } from "@/features/agent";
import { useBass2Overview } from "@/features/bass2";
import { useSameROverview } from "@/features/same-r";
import { useOverview } from "@/features/study-overview";
import { useHealth } from "@/shared/api/health";
import { ScrollToTop } from "./ScrollToTop";
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
  {
    prefix: "/studies/bass2",
    tag: "BASS-II",
    nav: [
      { to: "/studies/bass2", label: "Overview", end: true },
      { to: "/studies/bass2/tests", label: "Tests", end: false },
    ],
  },
];

export function Layout() {
  return (
    <AgentProvider>
      <a className="skip" href="#main">Skip to content</a>
      <ScrollToTop />
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
          {/* the site icon is the favicon: one drawing for the tab and the header */}
          <img src="/favicon.svg" width={24} height={24} alt="" className="brand-icon" />
          <span className="h-brand">StayHard</span>
        </Link>
        {study && (
          <span className="tag top-study" aria-label={`Current study: ${study.tag}`}>
            {study.tag}
          </span>
        )}
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
  const path = useLocation().pathname;
  const sameR = path.startsWith("/studies/same-r");
  const bass2 = path.startsWith("/studies/bass2");
  const overview = useOverview();
  const sameROverview = useSameROverview(sameR);
  const bass2Overview = useBass2Overview(bass2);
  const health = useHealth();
  const doi = sameR ? sameROverview.data?.doi : bass2 ? bass2Overview.data?.doi : overview.data?.about.doi;
  const dataset = sameR ? "SAME-R (PSI-101)" : bass2 ? "BASS-II (PSI-25)" : "FLEX (PSI-69)";
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
