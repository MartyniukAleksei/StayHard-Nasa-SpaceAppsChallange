import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/shared/api/client";
import type { VideoSeries } from "./lib/replay";

/** The part of the BASS-II test report the replay reads (a subset of features/bass2 TestDetail). */
export interface ReplayRow {
  test_id: string;
  pi: string;
  material: string;
  thickness_mm: number | null;
  diameter_mm: number | null;
  o2_initial_pct: number | null;
  o2_final_pct: number | null;
  flow_config: "Opposed" | "Concurrent" | "Stagnation" | null;
  outcome: string | null;
}
export interface ReplayReport {
  test: ReplayRow;
  psi_videos: { index: number; label: string; url: string; bytes: number }[];
  video_series: VideoSeries | null;
}

/** Same query key as the BASS-II test page, so the report is fetched once per session. */
export const useReplayReport = (id: string | null) =>
  useQuery({
    queryKey: ["bass2", "test", id],
    queryFn: () => apiGet<ReplayReport>(`/studies/bass2/tests/${encodeURIComponent(id!)}/report`),
    enabled: id != null,
  });

/** API paths from the backend (`/api/...`) → URL the browser can open (dev proxy or VITE_API_URL). */
export const apiHref = (path: string) => `${import.meta.env.VITE_API_URL ?? ""}${path}`;
