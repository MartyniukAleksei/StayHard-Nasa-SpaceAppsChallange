import { useState } from "react";
import { mediaUrl, type FileItem, type TestDetail } from "@/features/flex-tests";
import { DropletReplay } from "@/features/replay";

type Tab = { id: string; label: string; video?: FileItem };

/** G: real camera video when the dataset has it, otherwise the replay drawn from measured data. */
export function MediaBlock({ t, compact = false }: { t: Pick<TestDetail, "test_no" | "has_series" | "videos">; compact?: boolean }) {
  const tabs: Tab[] = [
    ...t.videos.map((v) => ({ id: v.path, label: v.name.replace(/\.mp4$/i, ""), video: v })),
    ...(t.has_series ? [{ id: "replay", label: "Replay from data" }] : []),
  ];
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const tab = tabs.find((x) => x.id === active) ?? tabs[0];

  if (!tab) return <p className="placeholder">No video and no measured series for this test.</p>;

  return (
    <div className={compact ? "tp-media compact" : "tp-media"}>
      {tabs.length > 1 && (
        <div className="tp-tabs" role="tablist" aria-label="Media">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === tab.id}
              className={x.id === tab.id ? "on" : undefined}
              onClick={() => setActive(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
      )}
      {tab.video ? (
        <figure className="tp-video">
          <video controls preload="metadata" src={mediaUrl(tab.video.path)}>
            <track kind="captions" />
          </video>
          <figcaption className="replay-note">NASA camera video · {tab.video.name}</figcaption>
        </figure>
      ) : (
        <DropletReplay testNo={t.test_no} />
      )}
    </div>
  );
}
