// Mirrors backend/src/flame/studies/same_r/schemas.py.
export interface Source {
  url: string;
  title: string;
  text: string;
}

/** One row of the experiment table (tests.csv). `73` and `73a` share test_no 73. */
export interface TestRow {
  test_no: number;
  test_id: string;
  material: string | null;
  description: string | null;
  date_2010: string | null;
  inlet_velocity_cm_s: number | string | null;
  heater_rt_r0: number | string | null;
  heating_s: number | string | null;
  net_aging_s: number | string | null;
  has_timeseries: boolean;
}

export interface Coverage {
  t_min: number;
  t_max: number;
  ptrak_peak_per_cc: number | null;
  ptrak_peak_t_s: number | null;
  active_detectors: string[];
}

export interface TemArchive {
  name: string;
  sample_id: string | null;
  aging: string | null;
}

export interface TestDetail {
  test_no: number;
  rows: TestRow[];
  coverage: Coverage | null;
  tem_archives: TemArchive[];
  sources: Source[];
}

export interface TimeSeries {
  test_no: number;
  signal: string;
  columns: string[];
  rows: (number | null)[][];
  n_total: number;
  sources: Source[];
}
