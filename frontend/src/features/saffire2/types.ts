// Mirrors backend/src/flame/studies/saffire2/schemas.py.

export type Verdict = "earth_stricter" | "match" | "earth_weaker" | "not_comparable" | "unknown";

export type About = {
  acronym: string;
  title: string;
  accession: string;
  doi: string;
  flight_program: string;
  hardware: string;
  pi: string;
  start_date: string;
  end_date: string;
  objective: string;
  hypothesis: string;
  license: string;
  license_name: string;
  license_link: string;
  citation: string;
  contacts: { name: string; affiliation: string }[];
  publications: { title: string; authors: string; doi: string }[];
};

export type FileItem = { name: string; category: string; kind: string; mb: number };

export type SampleFiles = { test_id: string; files: FileItem[]; image_archives: number; image_archives_gb: number };

export type SensorStats = {
  epoch_start_ms: number;
  epoch_end_ms: number;
  ignition_epoch_ms: number | null;
  duration_s: number;
  ignition_t_s: number | null;
  igniter_on_s: number | null;
  peak_sample_t_c: number | null;
  peak_plume_t_c: number | null;
  co2_start_pct: number | null;
  co2_rise_pct: number | null;
  o2_mean_pct: number | null;
  flow_mean_cm_s: number | null;
  flow_sd_cm_s: number | null;
  fan_rpm_mean: number | null;
  pressure_mean_psia: number | null;
  humidity_mean_pct: number | null;
  inlet_t_mean_c: number | null;
  radiometer_peak_mw_cm2: number | null;
};

export type Spread = { lo: number | null; hi: number | null; accelerating: boolean; note: string };

export type Sample = {
  test_id: string;
  material: string;
  material_filled_down: boolean;
  thickness_mm: number | null;
  thickness_raw: string;
  length_raw: string;
  flow_direction: string;
  air_flow_cm_s: number | null;
  o2_pct_table: number | null;
  ignition_power_w: number | null;
  ignition_time_s: number | null;
  burn_time_s: number | null;
  ug_burn_length_raw: string;
  g1_burn_length_raw: string;
  ug_spread_raw: string;
  g1_spread_rate_raw: string;
  camera1: string;
  camera2: string;
  ug_burn_cm: number | null;
  g1_burn_cm: number | null;
  ug_spread: Spread;
  g1_spread: Spread;
  verdict: Verdict;
  sensors: SensorStats | null;
};

export type Co2Track = { test_id: string; points: [number, number][] };

export type Dashboard = {
  about: About;
  sample_length_cm: number;
  notes: Record<string, string>;
  samples: Sample[];
  co2_timeline: Co2Track[];
  documents: FileItem[];
};

export type Num = number | null;

export type Series = {
  test_id: string;
  ignition_t_s: Num;
  t: number[];
  sample_tc: Num[][];
  plume_tc: Num[][];
  radiometers: Num[][];
  radiometer_baseline: Num[];
  co2_pct: Num[];
  o2_pct: Num[];
  igniter_a: Num[];
  anemometer_1: Num[];
  anemometer_2: Num[];
  pressure_psia: Num[];
};
