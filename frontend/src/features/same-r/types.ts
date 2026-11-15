// Mirrors backend/src/flame/studies/same_r/schemas.py (the 3D replay types are in features/same-r-3d).
import type { Source, TestDetail, TestRow } from "@/features/same-r-3d";

export type Row = TestRow & {
  primary_aging_s: number | string | null;
  primary_mixing_s: number | string | null;
  ptrak_peak_per_cc?: number | null; // only in the tests list (derived from ts_sensors)
  active_detectors?: string[] | null;
  has_tem?: boolean;
};

// url: a local snapshot file served by the API, or a redirect to NASA PSI when the file is not in the snapshot
export type FileItem = { name: string; title: string; url: string; bytes: number; category: string; local: boolean };
export type DocGroup = { category: string; files: FileItem[] };

export type Overview = {
  acronym: string;
  title: string;
  accession: string;
  doi: string | null;
  objective: string;
  hypothesis: string;
  flight_program: string;
  start_date: string;
  end_date: string;
  documents: DocGroup[];
  sources: Source[];
};

export type TestList = { tests: Row[]; sources: Source[] };
export type PageDetail = Omit<TestDetail, "rows"> & { rows: Row[]; files: FileItem[] };

export type Photos = { psi_file: string; images: { name: string; url: string }[] };
