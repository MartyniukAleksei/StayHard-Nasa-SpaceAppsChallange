import { useQuery } from "@tanstack/react-query";
import { sameRSeriesQuery, sameRTestQuery } from "@/features/same-r-3d";
export { apiUrl, useTem } from "@/features/same-r-3d";
import { apiGet } from "@/shared/api/client";
import type { Overview, PageDetail, Photos, TestList } from "./types";


export const useSameROverview = (enabled = true) =>
  useQuery({ queryKey: ["same-r", "overview"], queryFn: () => apiGet<Overview>("/studies/same-r/overview"), enabled });

export const useSameRTests = () =>
  useQuery({ queryKey: ["same-r", "tests"], queryFn: () => apiGet<TestList>("/studies/same-r/tests") });

// Same keys as the 3D replay: one request serves both. The page reads the extra `files` field.
export const useSameRTest = (testNo: number) => {
  const q = sameRTestQuery(testNo);
  return useQuery({ ...q, queryFn: q.queryFn as () => Promise<PageDetail | null> });
};
export const useSameRSeries = (testNo: number, enabled: boolean) => useQuery({ ...sameRSeriesQuery(testNo), enabled });


/** ISS crew photos of the SAME-R hardware (from the snapshot). Not linked to tests. */
export const usePhotos = () =>
  useQuery({ queryKey: ["same-r", "photos"], queryFn: () => apiGet<Photos>("/studies/same-r/photos"), staleTime: Infinity });
