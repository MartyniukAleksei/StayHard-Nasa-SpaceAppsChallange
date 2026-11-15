import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/shared/api/client";
import type { RegimeMap } from "./types";

export const useRegimeMap = () =>
  useQuery({
    queryKey: ["cfig", "regime"],
    queryFn: () => apiGet<RegimeMap>("/studies/cfig/regime"),
  });
