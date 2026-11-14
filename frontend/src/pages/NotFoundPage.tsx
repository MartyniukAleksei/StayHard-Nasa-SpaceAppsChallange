import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="page">
      <h1>Not found</h1>
      <Link to="/">Home</Link>
    </main>
  );
}
