// Mirror of backend flame.studies.bass2.schemas
export type Source = { url: string; title: string; text: string };

export type Finding = {
  id: string;
  group: "earth_vs_space" | "flammability" | "extinction" | "products" | "crew";
  title: string;
  value: string;
  earth_value: string | null;
  text: string;
  page: number;
  figure: string | null;
  source: Source;
};

export type CountItem = { key: string; label: string; count: number };

export type Facts = {
  n_tests: number;
  n_logged: number;
  first_year: number;
  last_year: number;
  n_pi: number;
  o2_min_pct: number;
  o2_max_pct: number;
  n_with_video: number;
  by_pi: CountItem[];
  by_material: CountItem[];
  by_flow: CountItem[];
  by_outcome: CountItem[];
};

export type Overview = {
  title: string;
  acronym: string;
  accession: string;
  doi: string;
  license_name: string;
  hypothesis: string;
  objective: string;
  approach: string;
  research_impacts: string;
  hardware: string;
  citation: string;
  facts: Facts;
  findings: Finding[];
  sources: Source[];
};

export type Outcome =
  | "quench"
  | "blowoff"
  | "no_ignition"
  | "flow_off"
  | "burnout"
  | "sustained"
  | "unknown";

export type FlowConfig = "Opposed" | "Concurrent" | "Stagnation";

export type TestRow = {
  test_id: string;
  pi: string;
  test_date: string | null;
  gmt_day: number | null;
  material: string;
  material_class: string;
  thickness_mm: number | null;
  diameter_mm: number | null;
  flow_restrictor: number | null;
  o2_initial_pct: number | null;
  o2_final_pct: number | null;
  o2_final_suspect: boolean;
  co2_initial_pct: number | null;
  co2_final_pct: number | null;
  co_initial_ppm: number | null;
  co_final_ppm: number | null;
  co_over_range: boolean;
  flow_config: FlowConfig | null;
  outcome: Outcome | null;
  outcome_confidence: "high" | "medium" | null;
  has_video: boolean;
  in_report_log: boolean;
};

export type FileItem = { name: string; url: string; bytes: number; kind: string };
export type PsiFile = { name: string; kind: string; bytes: number; version: string };
export type PsiVideo = { index: number; name: string; label: string; bytes: number; url: string };

export type LogEntry = {
  table: string;
  report_page: number;
  as_run_no: string | null;
  date_raw: string | null;
  time_raw: string | null;
  igniter: string | null;
  flow_config: FlowConfig | null;
  flow_config_raw: string | null;
  flow_config_derived: boolean;
  fan_display: string | null;
  air_display: string | null;
  radiometer_gain: string | null;
  o2_raw_initial_pct: string | null;
  o2_raw_final_pct: string | null;
  observations: string | null;
  outcome: Outcome;
  outcome_confidence: "high" | "medium";
  outcome_note: string | null;
  reused_sample: boolean;
};

export type VideoSeries = {
  psi_video_index: number | null;
  start_gmt: string;
  method: string;
  columns: string[];
  points: (number | null)[][];
};

export type TestDetail = {
  test: TestRow;
  sample_no: string | null;
  fan_display: string | null;
  air_display: string | null;
  radiometer_gain: string | null;
  total_frames: number | null;
  frames_note: string | null;
  log: LogEntry | null;
  pi_table: Record<string, unknown> | null;
  videos: FileItem[];
  files: FileItem[];
  psi_videos: PsiVideo[];
  psi_files: PsiFile[];
  video_series: VideoSeries | null;
  same_day: string[];
  sources: Source[];
};
