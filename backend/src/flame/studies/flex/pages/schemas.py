"""Pydantic-схеми відповідей /api/studies/flex/*. Фронтенд дзеркалить їх у features/*/types.ts."""

from pydantic import BaseModel


class Contact(BaseModel):
    name: str
    affiliation: str
    role: str


class About(BaseModel):
    title: str
    acronym: str
    accession: str
    objective: str
    hypothesis: str
    approach: str
    research_impacts: str
    hardware: str
    flight_program: str
    contacts: list[Contact]
    doi: str
    license_name: str
    license_link: str
    n_publications: int
    n_publications_with_doi: int
    citation: str


class Facts(BaseModel):
    n_tests: int
    fuels: list[str]
    diluents: list[str]
    first_year: int
    last_year: int


class EndCounts(BaseModel):
    extinction: int
    completion: int
    disruption: int


class PresetGroup(BaseModel):
    id: str
    label: str
    total: int
    by_end: EndCounts
    excluded_fiber: int
    excluded_fiber_unknown: int


class Preset(BaseModel):
    id: str
    question: str
    groups: list[PresetGroup]
    derived: bool
    note: str | None = None


class Overview(BaseModel):
    about: About
    facts: Facts
    presets: list[Preset]


class Replay(BaseModel):
    test_no: int
    fuel: str
    end_type: str
    burn_time_s: float | None
    d0_mm: float | None
    droplet: list[tuple[float, float]]
    flame: list[tuple[float, float]]
    standoff: list[tuple[float, float]] = []


class TestSummary(BaseModel):
    test_no: int
    fuel: str
    p_atm: float | None
    x_o2: float | None
    diluent: str
    d0_mm: float | None
    dext_mm: float | None
    k_mm2_s: float | None
    burn_time_s: float | None
    end_type: str
    fiber: bool | None
    has_series: bool
    has_video: bool
    cool_flame: bool


class FileItem(BaseModel):
    name: str
    path: str
    bytes: int
    kind: str
    title: str | None = None


class Neighbor(BaseModel):
    test_no: int
    p_atm: float | None
    x_o2: float | None
    d0_mm: float | None
    end_type: str
    distance: float


class TestDetail(BaseModel):
    test_no: int
    cir_id: str | None
    test_date: str | None
    test_gmt: str | None
    fuel: str
    p_atm: float | None
    x_o2: float | None
    x_n2: float | None
    x_co2: float | None
    x_he: float | None
    diluent: str
    d0_mm: float | None
    dext_mm: float | None
    k_mm2_s: float | None
    burn_time_s: float | None
    end_type: str
    fiber: bool | None
    temperature_k: float | None
    comment: str
    cool_flame: bool
    has_series: bool
    neighbors: list[Neighbor]
    files: list[FileItem]
    videos: list[FileItem]


class Publication(BaseModel):
    title: str
    authors: str
    doi: str


class DocumentGroup(BaseModel):
    category: str
    files: list[FileItem]


class Limitations(BaseModel):
    total: int
    fiber: int
    free: int
    fiber_unknown: int
    disruption: int
    missing_d0: int
    missing_k: int
    without_series: int
    with_video: int


class Library(BaseModel):
    citation: str
    doi: str
    license_name: str
    license_link: str
    publications: list[Publication]
    documents: list[DocumentGroup]
    limitations: Limitations
