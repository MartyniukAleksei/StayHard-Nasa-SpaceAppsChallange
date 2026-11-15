import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, apiGet } from "@/shared/api/client";
import { buildExperiment, type Experiment } from "./lib/experiment.ts";
import type { TestDetail, TimeSeries } from "./types";

export type ExperimentState =
  | { status: "pending" }
  | { status: "error"; message: string }
  | { status: "empty" } // the test exists but has no telemetry
  | { status: "ready"; experiment: Experiment };

/** null on 404: "no such series" is an answer, not an error. */
async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(`/studies/same-r${path}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

// The study page reads the same two queries (same keys), so the data is fetched once.
export const sameRTestQuery = (testNo: number) => ({
  queryKey: ["same-r", "test", testNo],
  queryFn: () => getOrNull<TestDetail>(`/tests/${testNo}`),
});

export const sameRSeriesQuery = (testNo: number) => ({
  queryKey: ["same-r", "series", testNo],
  queryFn: () => getOrNull<TimeSeries>(`/tests/${testNo}/timeseries/hkp`),
});

export type TemImage = { name: string; url: string };
export type TemArchiveImages = { psi_file: string; sample_id: string | null; aging: string | null; images: TemImage[] };
export type TemOut = { test_no: number; archives: TemArchiveImages[]; sources: TestDetail["sources"] };

/** TEM images of a test, read from NASA PSI (seconds on the first call; cached after). */
export const useTem = (testNo: number, enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["same-r", "tem", testNo],
    queryFn: () => apiGet<TemOut>(`/studies/same-r/tests/${testNo}/tem`),
    staleTime: Infinity,
  });

/** URLs from the API start with /api; in production the API lives on another host. */
export const apiUrl = (url: string) => `${import.meta.env.VITE_API_URL ?? ""}${url}`;

export function useSameRExperiment(testNo: number): ExperimentState {
  const detail = useQuery(sameRTestQuery(testNo));
  const series = useQuery(sameRSeriesQuery(testNo));
  // one Experiment per data load: the replay clock is keyed on its identity
  const experiment = useMemo(
    () => (detail.data && series.isSuccess ? buildExperiment(detail.data, series.data) : null),
    [detail.data, series.data, series.isSuccess],
  );
  const failed = detail.error ?? series.error;
  if (failed) return { status: "error", message: failed.message };
  if (detail.isPending || series.isPending) return { status: "pending" };
  if (!detail.data) return { status: "error", message: `no test #${testNo} in the experiment table` };
  return experiment ? { status: "ready", experiment } : { status: "empty" };
}
