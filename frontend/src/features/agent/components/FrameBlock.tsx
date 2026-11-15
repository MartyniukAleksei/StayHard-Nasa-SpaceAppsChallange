import { API_BASE } from "../api";
import type { Frame } from "../types";

const EVENT: Record<string, string> = { ignition: "ignition", extinction: "flame series ends", end: "droplet series ends" };

/** Кадри бортових камер, які знайшов агент (першоджерело NASA PSI). */
export function FrameStrip({ frames }: { frames: Frame[] }) {
  return (
    <div className="ag-frames">
      {frames.map((f) => (
        <figure key={f.url} className="ag-frame">
          <a href={`${API_BASE}${f.url.replace(/\?.*$/, "")}`} target="_blank" rel="noreferrer">
            <img src={`${API_BASE}${f.url}`} alt={`FLEX-${String(f.test_no).padStart(3, "0")} camera ${f.camera} at ${f.t_s} s`} loading="lazy" />
          </a>
          <figcaption className="mono small">
            FLEX-{String(f.test_no).padStart(3, "0")} · {f.camera_label} · t = {f.t_s.toFixed(2)} s
            {EVENT[f.event] ? ` · ${EVENT[f.event]}` : ""} <span className="tag ag-tag" title="Frame time is derived from the camera index and the test log">derived time</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
