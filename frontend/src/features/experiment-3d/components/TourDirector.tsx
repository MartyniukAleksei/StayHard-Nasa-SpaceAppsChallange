import { useEffect, useSyncExternalStore } from "react";
import type { TourRunner, TourStep } from "../lib/tour";

/** Drives the tour clock and shows its controls: step counter, the caption of the current step
 *  (the same text as the labels in the scene) and Pause / Next / Replay / Exit. */
export function TourDirector({ tour, onExit }: { tour: TourRunner; onExit: () => void }) {
  useSyncExternalStore(tour.subscribe, tour.getVersion);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      tour.update(Math.min(0.1, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tour]);

  const total = tour.spec.steps.length;
  const waiting = tour.phase === "waiting";
  const done = tour.phase === "done";
  const last = tour.index + 1 >= total;
  return (
    <section className="x3d-tour" aria-label="3D walkthrough from the assistant">
      <p className="x3d-tour-head mono">
        <span className="x3d-live">● 3D walkthrough</span>
        <span>{waiting ? "preparing" : `step ${tour.index + 1}/${total}`}</span>
        {tour.paused && <span>paused</span>}
        {done && <span>finished</span>}
      </p>
      <div className="x3d-tour-caption" role="status">
        {waiting ? (
          <p className="muted">Preparing 3D walkthrough…</p>
        ) : tour.labelsVisible ? (
          <Caption step={tour.step} sources={tour.spec.sources} />
        ) : (
          <p className="muted">Moving to the next moment…</p>
        )}
      </div>
      <div className="x3d-tour-actions">
        <button type="button" className="btn" onClick={() => tour.togglePause()} disabled={waiting || done}>
          {tour.paused ? "Resume" : "Pause"}
        </button>
        <button type="button" className="btn ghost" onClick={() => tour.next()} disabled={waiting || last}>
          Next
        </button>
        <button type="button" className="btn ghost" onClick={() => tour.replay()} disabled={waiting}>
          Replay
        </button>
        <button type="button" className="btn ghost" onClick={onExit}>
          Exit tour
        </button>
        {/* on a phone the assistant covers the page, so it steps aside for the tour */}
        <button type="button" className="btn ghost x3d-tour-chat" onClick={() => window.dispatchEvent(new CustomEvent("agent:open"))}>
          Chat
        </button>
      </div>
    </section>
  );
}

function Caption({ step, sources }: { step: TourStep; sources: { url: string; title: string }[] }) {
  if (step.labels.length === 0) return <p className="muted">No label for this step.</p>;
  return (
    <>
      {step.labels.map((label, i) => (
        <p key={i}>
          {label.text}
          {label.tags
            .filter((tag) => tag !== "data")
            .map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          {label.source != null && sources[label.source] && <span className="x3d-tour-source">{sources[label.source].title}</span>}
        </p>
      ))}
    </>
  );
}

/** Without WebGL there is no scene to direct: the steps are listed as text under the 2D replay. */
export function TourSteps({ steps }: { steps: TourStep[] }) {
  return (
    <ol className="x3d-tour-list">
      {steps.map((step, i) => (
        <li key={i}>
          {step.labels.length ? step.labels.map((l) => l.text).join(" · ") : step.moment.replace(/_/g, " ")}
        </li>
      ))}
    </ol>
  );
}
