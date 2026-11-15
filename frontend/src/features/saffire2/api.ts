import { useQueries, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/shared/api/client";
import type { Dashboard, SampleFiles, Series } from "./types";

export const useSaffireDashboard = (enabled = true) =>
  useQuery({
    queryKey: ["saffire2", "dashboard"],
    queryFn: () => apiGet<Dashboard>("/studies/saffire2/dashboard"),
    enabled,
  });

const seriesQuery = (id: string, enabled = true) => ({
  enabled,
  queryKey: ["saffire2", "series", id],
  queryFn: () => apiGet<Series>(`/studies/saffire2/samples/${encodeURIComponent(id)}/series`),
});

export const useSaffireSeries = (id: string, enabled = true) => useQuery(seriesQuery(id, enabled));

export const useSaffireSeriesMany = (ids: string[]) =>
  useQueries({ queries: ids.map((id) => seriesQuery(id)) });

export const useSaffireSampleFiles = (id: string) =>
  useQuery({
    queryKey: ["saffire2", "files", id],
    queryFn: () => apiGet<SampleFiles>(`/studies/saffire2/samples/${encodeURIComponent(id)}/files`),
  });
