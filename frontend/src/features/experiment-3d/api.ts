import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { mediaUrl, useTest } from "@/features/flex-tests";
import { apiGet, ApiError } from "@/shared/api/client";
import { buildExperiment, type Experiment } from "./lib/experiment";
import { parseLog } from "./lib/log";
import type { CameraInfo, FramesIndex, TimeSeries } from "./types";

const API = import.meta.env.VITE_API_URL ?? "";

const SIGNALS = ["droplet", "flame_uv", "flame_color"] as const;

const seriesQuery = (testNo: number, signal: string) => ({
  queryKey: ["flex", "timeseries", testNo, signal],
  // 404 means the test has no such signal, which is a normal answer here
  queryFn: () =>
    apiGet<TimeSeries>(`/studies/flex/tests/${testNo}/timeseries/${signal}?max_points=20000`).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }),
});

export type ExperimentState =
  | { status: "pending" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; experiment: Experiment };

/** Everything the 3D replay needs: test record, three time series and the hardware timing from the test log. */
export function useExperiment(testNo: number): ExperimentState {
  const test = useTest(testNo);
  const series = useQueries({ queries: SIGNALS.map((s) => seriesQuery(testNo, s)) });

  // the test-point log <CIR>.txt holds the zero of time and the needle / igniter moments
  const logFile = test.data?.files.find((f) => f.name === `${test.data.cir_id}.txt`);
  const log = useQuery({
    queryKey: ["flex", "test-log", testNo, logFile?.path],
    enabled: test.isSuccess,
    queryFn: async () => {
      if (!logFile) return null;
      const res = await fetch(mediaUrl(logFile.path));
      return res.ok ? parseLog(await res.text()) : null;
    },
  });

  const [droplet, flameUv, flameColor] = series.map((q) => q.data);
  const experiment = useMemo(() => {
    if (!test.data || droplet === undefined || flameUv === undefined || flameColor === undefined) return undefined;
    if (log.isPending) return undefined;
    return buildExperiment(test.data, { droplet, flameUv, flameColor }, log.data ?? null);
  }, [test.data, droplet, flameUv, flameColor, log.isPending, log.data]);

  const failed = [test, ...series].find((q) => q.isError);
  if (failed?.error) return { status: "error", message: failed.error.message };
  if (experiment === undefined) return { status: "pending" };
  if (experiment === null) return { status: "empty" };
  return { status: "ready", experiment };
}

export const useCameras = (testNo: number) =>
  useQuery({
    queryKey: ["flex", "cameras", testNo],
    queryFn: () => apiGet<{ cameras: CameraInfo[] }>(`/media/flex/${testNo}/cameras`).then((r) => r.cameras),
  });

/** Frame index of one camera. The first call per archive reads its directory from NASA PSI (3–6 s). */
export const useFramesIndex = (testNo: number, camera: string) =>
  useQuery({
    queryKey: ["flex", "frames", testNo, camera],
    queryFn: () => apiGet<FramesIndex>(`/media/flex/${testNo}/cameras/${camera}/frames`),
    retry: 1,
  });

export const frameUrl = (index: FramesIndex, i: number, maxSide: number) =>
  `${API}${index.frame_url.replace("{i}", String(i))}?max_side=${maxSide}`;
