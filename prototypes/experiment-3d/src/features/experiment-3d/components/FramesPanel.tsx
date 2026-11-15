import { useEffect, useMemo, useState } from "react";

import { fetchCameras, fetchFramesIndex, frameUrl } from "../api";
import type { Experiment } from "../lib/experiment";
import { usePlayback, type Playback } from "../lib/playback";
import type { CameraInfo, FramesIndex } from "../types";

const CAMERAS = ["D", "B"]; // кольорова і UV; HiBMS (A) — кадри по ~2 МБ, для прототипу зависокі
const MIN_KEYFRAME_STEP_S = 0.25;
const MAX_KEYFRAMES = 48; // на камеру: довгі тести беруть рідші кадри
const FRAME_SIDE = 384;
const PARALLEL = 2;

interface Props {
  experiment: Experiment;
  playback: Playback;
}

/** Справжні кадри з борту поруч із 3D-сценою, синхронно з годинником відтворення. */
export function FramesPanel({ experiment, playback }: Props) {
  const [cameras, setCameras] = useState<CameraInfo[] | null>(null);
  const testNo = experiment.test.test_no;

  useEffect(() => {
    let alive = true;
    fetchCameras(testNo).then(
      (c) => alive && setCameras(c),
      () => alive && setCameras([]),
    );
    return () => {
      alive = false;
    };
  }, [testNo]);

  const shown = CAMERAS.map((id) => cameras?.find((c) => c.camera === id)).filter((c): c is CameraInfo => !!c);
  return (
    <aside className="x3d-frames">
      <h2>
        Real onboard frames <small>NASA PSI archive</small>
      </h2>
      {experiment.ignitionEpochMs == null ? (
        <p className="x3d-frames-note">No test log to align frames with ignition time.</p>
      ) : cameras == null ? (
        <p className="x3d-frames-note">Looking up cameras…</p>
      ) : shown.length === 0 ? (
        <p className="x3d-frames-note">No camera frames in PSI for this test.</p>
      ) : (
        shown.map((c) => (
          <CameraFeed
            key={c.camera}
            camera={c}
            testNo={testNo}
            ignitionEpochMs={experiment.ignitionEpochMs!}
            tMin={experiment.tMin}
            tMax={experiment.tMax}
            playback={playback}
          />
        ))
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

interface Keyframe {
  i: number;
  t: number; // с від запалювання
  url: string;
}

function CameraFeed({ camera, testNo, ignitionEpochMs, tMin, tMax, playback }: FeedProps) {
  const [index, setIndex] = useState<FramesIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Keyframe[]>([]);
  const { t } = usePlayback(playback);

  useEffect(() => {
    let alive = true;
    fetchFramesIndex(testNo, camera.camera).then(
      (idx) => alive && setIndex(idx),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [testNo, camera.camera]);

  const step = Math.max(MIN_KEYFRAME_STEP_S, (tMax - tMin) / MAX_KEYFRAMES);

  // Ключові кадри: найближчий кадр до кожної позначки часу з кроком `step`.
  const keyframes = useMemo<Keyframe[]>(() => {
    if (!index?.start_time) return [];
    const start = Date.parse(`${index.start_time}Z`) - ignitionEpochMs;
    const times = index.t_ms.map((ms) => (ms == null ? NaN : (start + ms) / 1000));
    const out: Keyframe[] = [];
    let i = 0;
    for (let mark = tMin; mark <= tMax; mark += step) {
      while (i < times.length - 1 && Math.abs(times[i + 1] - mark) <= Math.abs(times[i] - mark)) i++;
      if (Number.isNaN(times[i]) || Math.abs(times[i] - mark) > step) continue;
      if (out.at(-1)?.i !== i) out.push({ i, t: times[i], url: frameUrl(index, i, FRAME_SIDE) });
    }
    return out;
  }, [index, ignitionEpochMs, tMin, tMax, step]);

  // Завантаження наперед: бекенд читає кожен кадр із PSI ~1–2 с, тому не більше PARALLEL одночасно.
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

  let current: Keyframe | null = null;
  for (const kf of loaded) {
    if (!current || Math.abs(kf.t - t) < Math.abs(current.t - t)) current = kf;
  }
  const stale = current != null && Math.abs(current.t - t) > step;

  return (
    <figure className="x3d-feed">
      <div className={`x3d-feed-image${stale ? " stale" : ""}`}>
        {current ? (
          <img src={current.url} alt={`${camera.label} frame ${current.i}`} />
        ) : (
          <span>{error ? "NASA PSI is not responding" : "Fetching frames from NASA PSI…"}</span>
        )}
        {keyframes.length > 0 && loaded.length < keyframes.length && (
          <div className="x3d-feed-progress" style={{ width: `${(loaded.length / keyframes.length) * 100}%` }} />
        )}
      </div>
      <figcaption>
        <b>{camera.label}</b> {camera.view.split(",")[0]}
        <small>
          {current ? `frame ${current.i} · t = ${current.t >= 0 ? "+" : "−"}${Math.abs(current.t).toFixed(2)} s` : "—"}
          {keyframes.length > 0 && loaded.length < keyframes.length && ` · ${loaded.length}/${keyframes.length} loaded`}
        </small>
        <small className="x3d-feed-file">{camera.psi_file}</small>
      </figcaption>
    </figure>
  );
}
