import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/shared/api/client";
import type { Overview } from "./types";

export const useOverview = () =>
  useQuery({
    queryKey: ["flex", "overview"],
    queryFn: () => apiGet<Overview>("/studies/flex/overview"),
  });
