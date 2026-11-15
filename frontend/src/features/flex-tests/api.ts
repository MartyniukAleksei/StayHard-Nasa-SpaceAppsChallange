import { useQueries, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/shared/api/client";
import type { Library, TestDetail, TestSummary, VideoItem } from "./types";

const API = import.meta.env.VITE_API_URL ?? "";

export const useTests = () =>
  useQuery({ queryKey: ["flex", "tests"], queryFn: () => apiGet<TestSummary[]>("/studies/flex/explorer") });

const testQuery = (id: number) => ({
  queryKey: ["flex", "test", id],
  queryFn: () => apiGet<TestDetail>(`/studies/flex/tests/${id}/report`),
});

export const useTest = (id: number) => useQuery({ ...testQuery(id), enabled: id > 0 });

export const useTestsDetail = (ids: number[]) => useQueries({ queries: ids.map(testQuery) });

export const useLibrary = () =>
  useQuery({ queryKey: ["flex", "library"], queryFn: () => apiGet<Library>("/studies/flex/library") });

export const useVideos = () =>
  useQuery({ queryKey: ["flex", "videos"], queryFn: () => apiGet<VideoItem[]>("/studies/flex/videos") });

/** Public URL of a file on the data volume (PDF, txt, mp4). */
export const mediaUrl = (path: string) =>
  `${API}/api/media/flex/files/${path.split("/").map(encodeURIComponent).join("/")}`;

export const seriesCsvUrl = (id: number) => `${API}/api/studies/flex/tests/${id}/series.csv`;
