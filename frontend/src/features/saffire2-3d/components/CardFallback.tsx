import type { SaffireSample } from "@/features/saffire2";

/** Without WebGL: the card layout (Readme Fig. 1) with each sample's burned length from the table. */
export function CardFallback({ samples, reason }: { samples: SaffireSample[]; reason: string }) {
  return (
    <div className="sf3d-fallback">
      <p className="sf3d-note">{reason} Showing the sample card with the burned length from the experiment table instead.</p>
      <svg viewBox="0 0 330 440" role="img" aria-label="Saffire-II sample card with burned lengths">
        {samples.map((s) => {
          const n = Number(s.test_id.split("-")[1]);
          const x = 30 + ((n - 1) % 3) * 100;
          const y = 20 + Math.floor((n - 1) / 3) * 140;
          const h = 116;
          const burned = Math.min(1, (s.ug_burn_cm ?? 0) / 29) * h;
          const top = s.flow_direction === "opposed";
          return (
            <g key={s.test_id}>
              <rect className="strip" x={x + 30} y={y} width={20} height={h} />
              {burned > 0 && <rect className="char" x={x + 30} y={top ? y : y + h - burned} width={20} height={burned} />}
              <text x={x + 40} y={y + h + 14} textAnchor="middle">
                {s.test_id} · {s.ug_burn_length_raw}
              </text>
            </g>
          );
        })}
        <text x={165} y={436} textAnchor="middle">↑ air flow</text>
      </svg>
    </div>
  );
}
