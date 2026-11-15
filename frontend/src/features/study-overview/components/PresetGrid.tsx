import { EndMark } from "@/shared/ui/EndMark";
import type { Preset, PresetGroup } from "../types";

export function PresetGrid({ presets }: { presets: Preset[] }) {
  return (
    <section className="band ov-presets-band" aria-labelledby="presets-title">
      <div className="wrap">
        <h2 id="presets-title" className="h-section">Questions this data already answers</h2>
        <p className="lede">
          Counts are free-floating droplets only. Fiber-supported tests are never mixed in; they
          are listed separately under each card.
        </p>
        <p className="ov-soon mono">Opening each set in the Test explorer is coming soon.</p>
        <ul className="cells ov-presets">
          {presets.map((p) => (
            <PresetCard key={p.id} preset={p} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function PresetCard({ preset }: { preset: Preset }) {
  const split = preset.groups.length > 1;
  return (
    <li className="cell ov-preset">
      <h3>{preset.question}</h3>
      <div className={split ? "ov-groups split" : "ov-groups"}>
        {preset.groups.map((g) => (
          <GroupAnswer key={g.id} group={g} showLabel={split} />
        ))}
      </div>
      {preset.derived && preset.note && (
        <p className="ov-note">
          <span className="tag">derived</span> {preset.note.replace(/^Derived:\s*/, "")}
        </p>
      )}
    </li>
  );
}

function GroupAnswer({ group, showLabel }: { group: PresetGroup; showLabel: boolean }) {
  const excluded = excludedText(group);
  return (
    <div className="ov-group">
      {showLabel && <div className="ov-group-label mono">{group.label}</div>}
      <div className="stat">
        <b>{group.total}</b>
        <span>free-floating tests</span>
      </div>
      <div className="ov-ends small">
        <EndMark type="Extinction" count={group.by_end.extinction} short />
        <EndMark type="Disruption" count={group.by_end.disruption} short />
        <EndMark type="Completion" count={group.by_end.completion} short />
      </div>
      {excluded && <p className="ov-excluded">{excluded}</p>}
    </div>
  );
}

function excludedText(g: PresetGroup): string | null {
  const parts = [];
  if (g.excluded_fiber) parts.push(`${g.excluded_fiber} on a fiber`);
  if (g.excluded_fiber_unknown) parts.push(`${g.excluded_fiber_unknown} fiber unknown`);
  return parts.length ? `Not counted: ${parts.join(", ")}` : null;
}
