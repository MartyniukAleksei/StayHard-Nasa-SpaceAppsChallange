import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/shared/api/client";
import type { StudyCard } from "./types";

export const useStudies = () =>
  useQuery({ queryKey: ["studies"], queryFn: () => apiGet<StudyCard[]>("/studies") });
