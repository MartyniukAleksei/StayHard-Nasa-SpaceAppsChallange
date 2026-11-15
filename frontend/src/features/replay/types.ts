// Mirror of backend flame.studies.flex.schemas.Replay
export type SeriesPoint = [t_s: number, d_mm: number];

export type Replay = {
  test_no: number;
  fuel: string;
  end_type: string;
  burn_time_s: number | null;
  d0_mm: number | null;
  droplet: SeriesPoint[];
  flame: SeriesPoint[];
};
