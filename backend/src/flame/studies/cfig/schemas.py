from pydantic import BaseModel


class About(BaseModel):
    accession: str
    acronym: str
    title: str
    doi: str
    doi_url: str
    license: str
    version: int | None
    citation: str


class Facts(BaseModel):
    n_tests: int
    n_normal: int
    n_inverse: int
    fuels: list[str]
    n_self_extinguished: int
    n_flow_terminated: int
    n_cool_flame_noted: int


class RegimeTest(BaseModel):
    """Один рядок таблиці PSI-159; значення як у джерелі, окрім позначених `derived`."""

    test_id: str
    flame_type: str  # normal | inverse
    fuel: str
    p_bar: float | None
    x_o2: float | None  # XO2 перед тестом (normal) / окислювач (inverse)
    x_o2_after: float | None
    fuel_flow_mg_s: float | None
    tad_k: float | None
    zst: float | None
    hot_ignition: bool | None
    burn_time_s: float | None
    end_mode: str | None  # self_extinguished (SE) | flow_terminated (FT) | null
    peak_burner_t_c: float | None
    cool_flame: bool | None  # derived з "Cool flame?" таблиці; null = колонки для цього тесту нема
    cool_flame_note: str | None
    comment: str | None
    has_telemetry: bool


class RegimeMap(BaseModel):
    about: About
    facts: Facts
    tests: list[RegimeTest]
