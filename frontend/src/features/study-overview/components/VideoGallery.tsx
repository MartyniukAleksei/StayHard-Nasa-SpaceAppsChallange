import { useState } from "react";
import { Link } from "react-router";
import { mediaUrl, testHref, useVideos, type VideoItem } from "@/features/flex-tests";
import { chem, num, pct } from "@/shared/lib/format";
import { EndMark } from "@/shared/ui/EndMark";

const label = (v: VideoItem) => v.name.replace(/\.mp4$/i, "").replace(/^_+/, "").trim();

/** G: real NASA camera videos from the FLEX dataset, one large player and the rest as a list. */
export function VideoGallery() {
  const { data, isPending, isError } = useVideos();
  const [active, setActive] = useState<string | null>(null);

  if (isPending) return <div className="ov-video-empty mono">Loading NASA videos…</div>;
  if (isError || !data || data.length === 0) {
    return <div className="ov-video-empty mono">No video available.</div>;
  }
  const current = data.find((v) => v.path === active) ?? data[0];

  return (
    <div className="ov-videos">
      <figure className="ov-video">
        <video key={current.path} controls preload="metadata" src={mediaUrl(current.path)}>
          <track kind="captions" />
        </video>
        <figcaption>
          <Caption v={current} />
          <span className="muted small">NASA camera video · PSI FLEX · {label(current)}</span>
        </figcaption>
      </figure>
      <div className="ov-video-list">
        <p className="mono small muted">
          {data.length} camera videos from {new Set(data.map((v) => v.test_no)).size} tests
        </p>
        <ul>
          {data.map((v) => (
            <li key={v.path}>
              <button
                type="button"
                aria-pressed={v.path === current.path}
                className={v.path === current.path ? "on" : undefined}
                onClick={() => setActive(v.path)}
              >
                <span>
                  <span className="mono">#{v.test_no}</span> {label(v)}
                </span>
                <span className="muted small">
                  {v.fuel} · {pct(v.x_o2)} O₂ · {num(v.p_atm, 2, "atm")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Caption({ v }: { v: VideoItem }) {
  return (
    <span className="ov-video-cap">
      <b className="mono">#{v.test_no}</b> · {v.fuel} · {pct(v.x_o2)} O₂ in {chem(v.diluent)} · {num(v.p_atm, 2, "atm")} ·{" "}
      <EndMark type={v.end_type} />{" "}
      <Link to={testHref(v.test_no)} className="btn ghost">
        Open test
      </Link>
    </span>
  );
}
