import { SameR3D } from "@/features/same-r-3d";

// acceptance tests from the scene passport: typical, saturated P-Trak, incomplete detector set
const ACCEPTANCE = [73, 53, 89];

export function App() {
  const query = new URLSearchParams(location.search);
  const testNo = Number(query.get("test")) || ACCEPTANCE[0];
  // ?t=514 opens the replay paused at that second: for checking readouts against the CSV
  const startAt = query.has("t") ? Number(query.get("t")) : undefined;
  return (
    <main className="page">
      <header className="page-head">
        <h1>SAME-R · test #{testNo} · 3D replay (prototype)</h1>
        <nav className="mono">
          {ACCEPTANCE.map((n) => (
            <a key={n} href={`?test=${n}`} aria-current={n === testNo ? "page" : undefined}>
              [ #{n} ]
            </a>
          ))}
        </nav>
      </header>
      <SameR3D testNo={testNo} startAt={startAt} />
    </main>
  );
}
