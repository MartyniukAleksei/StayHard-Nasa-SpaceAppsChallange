import { Link, NavLink, Outlet, useLocation } from "react-router";
import { AgentLauncher, AgentPanel, AgentProvider } from "@/features/agent";
import { useBass2Overview } from "@/features/bass2";
import { useSaffireDashboard } from "@/features/saffire2";
import { useSameROverview } from "@/features/same-r";
import { useOverview } from "@/features/study-overview";
import { useHealth } from "@/shared/api/health";
import { ScrollToTop } from "./ScrollToTop";
import "./shell.css";
import { Logo } from "./logo/Logo";

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
    prefix: "/studies/saffire2",
    tag: "SAFFIRE-II",
    nav: [
      { to: "/studies/saffire2", label: "Overview", end: true },
      { to: "/studies/saffire2/samples", label: "Samples", end: false },
      { to: "/studies/saffire2/compare", label: "Compare", end: true },
      { to: "/studies/saffire2/library", label: "Library", end: true },
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
          {/* the favicon's pixel fire, animated */}
          <Logo />
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
          <a
            className="top-gh"
            href="https://github.com/MartyniukAleksei/nasa-2026"
            target="_blank"
            rel="noreferrer"
            aria-label="Source code on GitHub"
            title="GitHub"
          >
            <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </span>
      </div>
    </header>
  );
}

function Footer() {
  const path = useLocation().pathname;
  const sameR = path.startsWith("/studies/same-r");
  const saffire = path.startsWith("/studies/saffire2");
  const bass2 = path.startsWith("/studies/bass2");
  const overview = useOverview();
  const sameROverview = useSameROverview(sameR);
  const saffireDash = useSaffireDashboard(saffire);
  const bass2Overview = useBass2Overview(bass2);
  const health = useHealth();
  const doi = sameR
    ? sameROverview.data?.doi
    : saffire
      ? saffireDash.data?.about.doi
      : bass2
        ? bass2Overview.data?.doi
        : overview.data?.about.doi;
  const dataset = sameR ? "SAME-R (PSI-101)" : saffire ? "Saffire-II (PSI-99)" : bass2 ? "BASS-II (PSI-25)" : "FLEX (PSI-69)";
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
