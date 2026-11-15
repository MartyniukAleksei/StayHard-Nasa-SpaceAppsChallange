// Mirror of backend flame.studies.catalog.StudyCard
import type { Facts } from "@/features/study-overview";

export type StudyCard = {
  accession: string;
  acronym: string;
  title: string;
  doi: string;
  research_area: string;
  sub_research_area: string;
  flight_program: string;
  objective: string;
  status: "active" | "coming_soon";
  route: string | null;
  facts: Facts | null;
};
