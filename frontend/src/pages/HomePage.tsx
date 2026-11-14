import { useHealth } from "@/shared/api/health";

export function HomePage() {
  const { data, isPending, isError } = useHealth();

  return (
    <main className="page">
      <h1>Flame in Freefall</h1>
      <p className="muted">
        Agentic explorer of NASA FLEX (PSI-69) droplet-combustion tests from the ISS.
      </p>
      <section className="card">
        <h2>API status</h2>
        {isPending && <p>Checking…</p>}
        {isError && <p className="bad">Backend unreachable</p>}
        {data && (
          <ul>
            <li>status: <b className="ok">{data.status}</b> ({data.env})</li>
            <li>database: {data.db ? "ready" : "not built"}</li>
            <li>FLEX data: {data.flex_data ? "mounted" : "missing"}</li>
          </ul>
        )}
      </section>
    </main>
  );
}
