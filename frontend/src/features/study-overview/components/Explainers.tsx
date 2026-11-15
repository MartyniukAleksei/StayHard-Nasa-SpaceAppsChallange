import { Link } from "react-router";

/** Link to the explorer, at the end of the story. */
export function BrowseTests() {
  return (
    <section className="band" aria-label="All tests">
      <div className="wrap ov-browse">
        <p className="lede">Every test, filterable by fuel, oxygen, pressure and outcome.</p>
        <Link className="btn" to="/studies/flex/tests">
          Browse all tests →
        </Link>
      </div>
    </section>
  );
}
