import { useOverview } from "../api";
import { AboutDetails } from "./AboutDetails";
import { Example3D } from "./Example3D";
import { BrowseTests, Findings, HowItWorked, Traps } from "./Explainers";
import { Hero } from "./Hero";
import { PresetGrid } from "./PresetGrid";
import "./overview.css";

/** FLEX overview, layout 1A "long story" (docs/tasks/0002-pages-1a-2b-3a-4a-5b.md). */
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
      <Hero about={data.about} facts={data.facts} />
      <Example3D />
      <HowItWorked />
      <Findings />
      <PresetGrid presets={data.presets} />
      <Traps />
      <AboutDetails about={data.about} />
      <BrowseTests />
    </div>
  );
}
