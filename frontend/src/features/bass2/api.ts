import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/shared/api/client";
import type { Overview, TestDetail, TestRow } from "./types";

export const useBass2Overview = () =>
  useQuery({
    queryKey: ["bass2", "overview"],
    queryFn: () => apiGet<Overview>("/studies/bass2/overview"),
  });

export const useBass2Tests = () =>
  useQuery({
    queryKey: ["bass2", "tests"],
    queryFn: () => apiGet<TestRow[]>("/studies/bass2/tests"),
  });

export const useBass2Test = (id: string) =>
  useQuery({
    queryKey: ["bass2", "test", id],
    queryFn: () => apiGet<TestDetail>(`/studies/bass2/tests/${encodeURIComponent(id)}`),
  });

/** API paths from the backend (`/api/...`) → URL the browser can open (dev proxy or VITE_API_URL). */
export const apiHref = (path: string) => `${import.meta.env.VITE_API_URL ?? ""}${path}`;

export const testHref = (id: string) => `/studies/bass2/tests/${encodeURIComponent(id)}`;
