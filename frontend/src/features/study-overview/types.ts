// Mirror of backend flame.studies.flex.schemas.Overview

export type Contact = { name: string; affiliation: string; role: string };

export type About = {
  title: string;
  acronym: string;
  accession: string;
  objective: string;
  hypothesis: string;
  approach: string;
  research_impacts: string;
  hardware: string;
  flight_program: string;
  contacts: Contact[];
  doi: string;
  license_name: string;
  license_link: string;
  n_publications: number;
  n_publications_with_doi: number;
  citation: string;
};

export type Facts = {
  n_tests: number;
  fuels: string[];
  diluents: string[];
  first_year: number;
  last_year: number;
};

export type EndCounts = { extinction: number; completion: number; disruption: number };

export type PresetGroup = {
  id: string;
  label: string;
  total: number;
  by_end: EndCounts;
  excluded_fiber: number;
  excluded_fiber_unknown: number;
};

export type Preset = {
  id: string;
  question: string;
  groups: PresetGroup[];
  derived: boolean;
  note: string | null;
};

export type Overview = { about: About; facts: Facts; presets: Preset[] };
