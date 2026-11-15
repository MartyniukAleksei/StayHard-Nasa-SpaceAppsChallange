import { useQueries, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/shared/api/client";
import type { Replay } from "./types";

const replayQuery = (testNo: number) => ({
  queryKey: ["flex", "replay", testNo],
  queryFn: () => apiGet<Replay>(`/studies/flex/tests/${testNo}/replay`),
});

export const useReplay = (testNo: number) => useQuery(replayQuery(testNo));

export const useReplays = (ids: number[]) => useQueries({ queries: ids.map(replayQuery) });
