import { useOverview } from "../api";
import { AboutDetails } from "./AboutDetails";
import { Explainers } from "./Explainers";
import { Hero } from "./Hero";
import { PresetGrid } from "./PresetGrid";
import "./overview.css";

/** FLEX overview, layout 1B "Hub" (docs/tasks/0001-home-overview-1b.md). */
export function StudyOverview() {
  const { data, isPending, isError, error } = useOverview();

  if (isPending) {
    return (
      <div className="wrap band">
        <p className="muted mono">Loading FLEX…</p>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="wrap band">
        <p className="placeholder" role="alert">
          Could not load FLEX data ({error.message}). Is the backend running and the database
          built?
        </p>
      </div>
    );
  }
  return (
    <div className="ov">
      <Hero facts={data.facts} />
      <PresetGrid presets={data.presets} />
      <Explainers />
      <AboutDetails about={data.about} />
    </div>
  );
}
