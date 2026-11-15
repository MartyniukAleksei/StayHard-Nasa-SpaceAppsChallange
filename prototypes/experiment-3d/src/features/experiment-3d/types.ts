// Дзеркало Pydantic-схем бекенду (studies/flex/schemas.py, media/schemas.py, core/citations.py).

export interface Source {
  url: string;
  title: string;
  text: string;
}

export interface TestRow {
  test_no: number;
  cir_id: string | null;
  test_date: string | null;
  fuel: string | null;
  p_atm: number | null;
  x_o2: number | null;
  x_n2: number | null;
  x_co2: number | null;
  x_he: number | null;
  diluent: string | null;
  d0_mm: number | null;
  dext_mm: number | null;
  k_mm2_s: number | null;
  burn_time_s: number | null;
  end_type: string | null;
  ts_fiber: boolean | null;
  ts_comment: string | null;
}

export interface TestFile {
  name: string;
  path: string;
  bytes: number;
  url: string;
}

export interface TestDetail {
  test: TestRow;
  files: TestFile[];
  url: string;
  sources: Source[];
}

export interface TimeSeries {
  test_no: number;
  signal: string;
  columns: string[];
  rows: (number | null)[][];
  n_total: number;
  url: string;
  sources: Source[];
}

export interface CameraInfo {
  camera: string;
  label: string;
  view: string;
  psi_file: string;
  archive_mb: number;
}

export interface FramesIndex {
  test_no: number;
  camera: string;
  label: string;
  psi_file: string;
  n_frames: number;
  start_time: string | null;
  fps: number | null;
  t_ms: (number | null)[];
  frame_url: string;
}
