import { useOverview } from "../api";
import { Example3D } from "./Example3D";
import { BrowseTests } from "./Explainers";
import { Findings } from "./Findings";
import { Hero } from "./Hero";
import { HowItWorked } from "./HowItWorked";
import { PresetGrid } from "./PresetGrid";
import { References } from "./References";
import { TestCards } from "./TestCards";
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
      <TestCards />
      <HowItWorked />
      <Findings />
      <PresetGrid presets={data.presets} />
      <BrowseTests />
      <References about={data.about} />
    </div>
  );
}
