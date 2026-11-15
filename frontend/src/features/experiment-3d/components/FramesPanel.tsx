import { useEffect, useMemo, useState } from "react";
import { frameUrl, useCameras, useFramesIndex } from "../api";
import type { Experiment } from "../lib/experiment";
import { frameTimes, keyframeStep, nearestKeyframe, pickKeyframes, type Keyframe } from "../lib/keyframes";
import { usePlayback, type Playback } from "../lib/playback";
import type { CameraInfo } from "../types";

const CAMERAS = ["D", "B"]; // colour and UV; HiBMS (A) frames are about 2 MB each, too heavy for this panel
const MIN_KEYFRAME_STEP_S = 0.25;
const MAX_KEYFRAMES = 48; // per camera: long tests get sparser frames
const FRAME_SIDE = 384;
const PARALLEL = 2; // the backend reads each frame from NASA PSI in 1–2 s

interface Props {
  experiment: Experiment;
  playback: Playback;
}

/** Real onboard frames next to the 3D scene, in step with the playback clock. */
export function FramesPanel({ experiment, playback }: Props) {
  const testNo = experiment.test.test_no;
  const cameras = useCameras(testNo);
  const shown = CAMERAS.map((id) => cameras.data?.find((c) => c.camera === id)).filter((c): c is CameraInfo => !!c);

  let body;
  if (experiment.ignitionEpochMs == null) {
    body = <p className="x3d-note">This test has no log to align the frames with ignition time.</p>;
  } else if (cameras.isPending) {
    body = <p className="x3d-note">Looking up cameras…</p>;
  } else if (shown.length === 0) {
    body = <p className="x3d-note">No camera frames in NASA PSI for this test.</p>;
  } else {
    body = shown.map((c) => (
      <CameraFeed
        key={c.camera}
        camera={c}
        testNo={testNo}
        ignitionEpochMs={experiment.ignitionEpochMs!}
        tMin={experiment.tMin}
        tMax={experiment.tMax}
        playback={playback}
      />
    ));
  }

  return (
    <aside className="x3d-frames" aria-label="Real onboard frames">
      <p className="x3d-frames-title mono">Real onboard frames · NASA PSI</p>
      {body}
      {/* methanol burns without soot, so the note is only for sooting fuels */}
      {shown.length > 0 && experiment.test.fuel !== "Methanol" && (
        <p className="x3d-note">
          A bright streak inside the flame in the colour frames is probably glowing soot. It is not in the 3D scene:
          the dataset has no soot measurements for it.
        </p>
      )}
    </aside>
  );
}

interface FeedProps {
  camera: CameraInfo;
  testNo: number;
  ignitionEpochMs: number;
  tMin: number;
  tMax: number;
  playback: Playback;
}

type LoadedFrame = Keyframe & { url: string };

function CameraFeed({ camera, testNo, ignitionEpochMs, tMin, tMax, playback }: FeedProps) {
  const index = useFramesIndex(testNo, camera.camera);
  const [loaded, setLoaded] = useState<LoadedFrame[]>([]);
  const { t } = usePlayback(playback);
  const step = keyframeStep(tMin, tMax, MIN_KEYFRAME_STEP_S, MAX_KEYFRAMES);

  const keyframes = useMemo<LoadedFrame[]>(() => {
    const idx = index.data;
    if (!idx?.start_time) return [];
    const times = frameTimes(idx.start_time, idx.t_ms, ignitionEpochMs);
    return pickKeyframes(times, tMin, tMax, step).map((k) => ({ ...k, url: frameUrl(idx, k.i, FRAME_SIDE) }));
  }, [index.data, ignitionEpochMs, tMin, tMax, step]);

  // preload in order, a few at a time
  useEffect(() => {
    let alive = true;
    let next = 0;
    setLoaded([]);
    const pump = () => {
      if (!alive || next >= keyframes.length) return;
      const kf = keyframes[next++];
      const img = new Image();
      img.onload = () => {
        if (alive) setLoaded((prev) => [...prev, kf]);
        pump();
      };
      img.onerror = pump;
      img.src = kf.url;
    };
    for (let k = 0; k < PARALLEL; k++) pump();
    return () => {
      alive = false;
    };
  }, [keyframes]);

  const current = nearestKeyframe(loaded, t);
  const stale = current != null && Math.abs(current.t - t) > step;
  const loading = keyframes.length > 0 && loaded.length < keyframes.length;

  return (
    <figure className="x3d-feed">
      <div className={stale ? "x3d-feed-image stale" : "x3d-feed-image"}>
        {current ? (
          <img src={current.url} alt={`${camera.label} camera, frame ${current.i} of test ${testNo}`} />
        ) : (
          <span>{index.isError ? "NASA PSI is not responding" : "Fetching frames from NASA PSI…"}</span>
        )}
        {loading && <div className="x3d-feed-progress" style={{ width: `${(loaded.length / keyframes.length) * 100}%` }} />}
      </div>
      <figcaption className="mono">
        <span className="x3d-feed-name">
          {camera.label} · {camera.view.split(",")[0]}
        </span>
        <span>
          {current ? `frame ${current.i} · t = ${current.t < 0 ? "−" : "+"}${Math.abs(current.t).toFixed(2)} s` : "—"}
          {loading && ` · ${loaded.length}/${keyframes.length} loaded`}
        </span>
        <span className="x3d-feed-file">{camera.psi_file}</span>
      </figcaption>
    </figure>
  );
}
