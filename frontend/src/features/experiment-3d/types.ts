// Mirror of backend flame.studies.flex.schemas.TimeSeries and flame.media.schemas

export interface Source {
  url: string;
  title: string;
  text: string;
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
