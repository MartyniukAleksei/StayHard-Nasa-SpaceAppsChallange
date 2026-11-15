import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Experiment3D } from "@/features/experiment-3d";
import { mediaUrl, type FileItem, type TestDetail } from "@/features/flex-tests";
import { DropletReplay } from "@/features/replay";

type Tab = { id: string; label: string; video?: FileItem };

const TAB_3D = "3d";

/** G: what opens first — the NASA camera video when the dataset has one, otherwise the 3D replay
 *  rebuilt from the measured data, then the 2D replay. The compact (compare) block has no 3D. */
export function MediaBlock({ t, compact = false }: { t: Pick<TestDetail, "test_no" | "has_series" | "has_3d" | "videos">; compact?: boolean }) {
  const tabs: Tab[] = [
    ...t.videos.map((v) => ({ id: v.path, label: v.name.replace(/\.mp4$/i, ""), video: v })),
    ...(t.has_3d && !compact ? [{ id: TAB_3D, label: "3D replay" }] : []),
    ...(t.has_series ? [{ id: "replay", label: "Replay from data" }] : []),
  ];
  // ?view=video|replay|3d&t=<s>: the assistant's "open video / replay at t" links (docs/agent/ui-actions.md)
  const [params] = useSearchParams();
  const view = compact ? null : params.get("view");
  const tParam = Number.parseFloat(params.get("t") ?? "");
  const startAt = !compact && Number.isFinite(tParam) ? tParam : undefined;
  const initial =
    (view === "video" && tabs.find((x) => x.video)?.id) ||
    (view === "replay" && tabs.find((x) => x.id === "replay")?.id) ||
    (view === TAB_3D && tabs.find((x) => x.id === TAB_3D)?.id) ||
    tabs[0]?.id ||
    "";
  const [active, setActive] = useState(initial);
  useEffect(() => setActive(initial), [initial]);
  const tab = tabs.find((x) => x.id === active) ?? tabs[0];
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view) box.current?.scrollIntoView({ block: "start" });
  }, [view, startAt]);

  if (!tab) return <p className="placeholder">No video and no measured series for this test.</p>;

  return (
    <div ref={box} className={compact ? "tp-media compact" : tab.id === TAB_3D ? "tp-media wide" : "tp-media"}>
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
        <Experiment3D key={startAt} testNo={t.test_no} startAt={startAt} />
      ) : (
        <DropletReplay key={startAt} testNo={t.test_no} startAt={startAt} />
      )}
    </div>
  );
}
