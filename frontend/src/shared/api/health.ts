import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client";

export type Health = { status: string; env: string; db: boolean; flex_data: boolean };

export const useHealth = () =>
  useQuery({ queryKey: ["health"], queryFn: () => apiGet<Health>("/health"), staleTime: 10_000 });
