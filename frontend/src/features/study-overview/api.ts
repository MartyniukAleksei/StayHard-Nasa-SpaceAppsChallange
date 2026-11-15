import { useQuery } from "@tanstack/react-query";
import { apiGet, ApiError } from "@/shared/api/client";
import type { Overview } from "./types";

export const useOverview = () =>
  useQuery({
    queryKey: ["flex", "overview"],
    queryFn: () => apiGet<Overview>("/studies/flex/overview"),
  });

export type SeriesResponse = { columns: string[]; rows: (number | null)[][] };

/** One signal of one test. Same query key and 404 handling as the 3D replay, so the cache is shared. */
export const useSignal = (testNo: number, signal: string, enabled = true) =>
  useQuery({
    queryKey: ["flex", "timeseries", testNo, signal],
    enabled,
    queryFn: () =>
      apiGet<SeriesResponse>(`/studies/flex/tests/${testNo}/timeseries/${signal}?max_points=20000`).catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }),
  });
