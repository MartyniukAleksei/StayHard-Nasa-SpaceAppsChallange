import { EndMark } from "@/shared/ui/EndMark";
import type { TestSummary } from "@/features/flex-tests";
import { endCounts, fiberKey, type Filters } from "../lib/filter";

/** D + L5: how the current selection ended. Numbers only, straight from the data. */
export function AnswerCard({ all, rows, filters }: { all: TestSummary[]; rows: TestSummary[]; filters: Filters }) {
  const c = endCounts(rows);
  const freeOnly = filters.fiber.length === 1 && filters.fiber[0] === "free";
  const hiddenFiber = freeOnly ? all.filter((t) => fiberKey(t.fiber) !== "free").length : 0;
  return (
    <section className="ex-answer" aria-live="polite">
      <div className="stat">
        <b>{rows.length}</b>
        <span>tests match</span>
      </div>
      <div className="ex-ends mono">
        <EndMark type="Extinction" count={c.Extinction} />
        <EndMark type="Disruption" count={c.Disruption} />
        <EndMark type="Completion" count={c.Completion} />
      </div>
      {freeOnly && (
        <p className="ex-note">
          Free-floating droplets only. {hiddenFiber} fiber-supported or unknown tests are a separate
          class — switch “Droplet” to include them.
        </p>
      )}
      {c.Disruption > 0 && (
        <p className="ex-note">Disruption means self-extinction was not observed, not that it would burn forever.</p>
      )}
    </section>
  );
}
