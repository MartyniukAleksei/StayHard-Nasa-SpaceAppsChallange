import { useState } from "react";
import { Experiment3D } from "@/features/experiment-3d";
import { mediaUrl, type FileItem, type TestDetail } from "@/features/flex-tests";
import { DropletReplay } from "@/features/replay";

type Tab = { id: string; label: string; video?: FileItem };

const TAB_3D = "3d";

/** G: real camera video when the dataset has it, otherwise the replay drawn from measured data.
 *  The 3D replay is one more tab on the full test page; it is not offered in the compact (compare) block. */
export function MediaBlock({ t, compact = false }: { t: Pick<TestDetail, "test_no" | "has_series" | "videos">; compact?: boolean }) {
  const tabs: Tab[] = [
    ...t.videos.map((v) => ({ id: v.path, label: v.name.replace(/\.mp4$/i, ""), video: v })),
    ...(t.has_series ? [{ id: "replay", label: "Replay from data" }] : []),
    ...(t.has_series && !compact ? [{ id: TAB_3D, label: "3D replay" }] : []),
  ];
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const tab = tabs.find((x) => x.id === active) ?? tabs[0];

  if (!tab) return <p className="placeholder">No video and no measured series for this test.</p>;

  return (
    <div className={compact ? "tp-media compact" : tab.id === TAB_3D ? "tp-media wide" : "tp-media"}>
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
      ) : tab.id === TAB_3D ? (
        <Experiment3D testNo={t.test_no} />
      ) : (
        <DropletReplay testNo={t.test_no} />
      )}
    </div>
  );
}
