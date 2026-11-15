import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="wrap band">
      <h1 className="h-display">Not found</h1>
      <Link to="/studies/flex" className="btn">
        Back to FLEX overview
      </Link>
    </div>
  );
}
