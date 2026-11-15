// Mirror of backend flame.studies.flex.schemas (TestSummary, TestDetail, Library)
import type { EndType } from "@/shared/ui/EndMark";

export type TestSummary = {
  test_no: number;
  fuel: string;
  p_atm: number | null;
  x_o2: number | null;
  diluent: string;
  d0_mm: number | null;
  dext_mm: number | null;
  k_mm2_s: number | null;
  burn_time_s: number | null;
  end_type: EndType;
  fiber: boolean | null;
  has_series: boolean;
  /** droplet series present: enough data for the 3D replay */
  has_3d: boolean;
  has_video: boolean;
  cool_flame: boolean;
};

export type FileItem = { name: string; path: string; bytes: number; kind: string; title?: string | null };

export type Neighbor = {
  test_no: number;
  p_atm: number | null;
  x_o2: number | null;
  d0_mm: number | null;
  end_type: EndType;
  distance: number;
};

export type TestDetail = Omit<TestSummary, "has_video"> & {
  cir_id: string | null;
  test_date: string | null;
  test_gmt: string | null;
  x_n2: number | null;
  x_co2: number | null;
  x_he: number | null;
  temperature_k: number | null;
  comment: string;
  neighbors: Neighbor[];
  files: FileItem[];
  videos: FileItem[];
};

/** NASA camera video (mp4 from PSI FLEX) with its test conditions, for the overview gallery. */
export type VideoItem = {
  test_no: number;
  fuel: string;
  diluent: string;
  x_o2: number | null;
  p_atm: number | null;
  end_type: EndType;
  name: string;
  path: string;
  bytes: number;
};

export type Limitations = {
  total: number;
  fiber: number;
  free: number;
  fiber_unknown: number;
  disruption: number;
  missing_d0: number;
  missing_k: number;
  without_series: number;
  with_video: number;
};

export type Library = {
  citation: string;
  doi: string;
  license_name: string;
  license_link: string;
  publications: { title: string; authors: string; doi: string }[];
  documents: { category: string; files: FileItem[] }[];
  limitations: Limitations;
};
