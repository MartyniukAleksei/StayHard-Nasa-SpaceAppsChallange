// Mirror of backend/src/flame/studies/cfig/schemas.py (GET /api/studies/cfig/regime).

export type EndMode = "self_extinguished" | "flow_terminated";

export interface About {
  accession: string;
  acronym: string;
  title: string;
  doi: string;
  doi_url: string;
  license: string;
  version: number | null;
  citation: string;
}

export interface Facts {
  n_tests: number;
  n_normal: number;
  n_inverse: number;
  fuels: string[];
  n_self_extinguished: number;
  n_flow_terminated: number;
  n_cool_flame_noted: number;
}

/** One row of the PSI-159 experimental table; values as in the source except `cool_flame` (derived). */
export interface RegimeTest {
  test_id: string;
  flame_type: "normal" | "inverse" | string;
  fuel: string;
  p_bar: number | null;
  x_o2: number | null;
  x_o2_after: number | null;
  fuel_flow_mg_s: number | null;
  tad_k: number | null;
  zst: number | null;
  hot_ignition: boolean | null;
  burn_time_s: number | null;
  end_mode: EndMode | null;
  peak_burner_t_c: number | null;
  /** derived from the table column "Cool flame?"; null = the table has no value for this test */
  cool_flame: boolean | null;
  cool_flame_note: string | null;
  comment: string | null;
  has_telemetry: boolean;
}

export interface RegimeMap {
  about: About;
  facts: Facts;
  tests: RegimeTest[];
}
