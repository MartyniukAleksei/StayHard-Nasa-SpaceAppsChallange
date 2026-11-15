"""Контракт /api/studies/saffire2/*. Дзеркало — frontend/src/features/saffire2/types.ts."""

from typing import Literal

from pydantic import BaseModel

Verdict = Literal["earth_stricter", "match", "earth_weaker", "not_comparable", "unknown"]


class About(BaseModel):
    acronym: str
    title: str
    accession: str
    doi: str
    flight_program: str
    hardware: str
    pi: str
    start_date: str
    end_date: str
    objective: str
    hypothesis: str
    license: str
    license_name: str
    license_link: str
    citation: str
    contacts: list["Contact"]
    publications: list["Publication"]


class Contact(BaseModel):
    name: str
    affiliation: str


class Publication(BaseModel):
    title: str
    authors: str
    doi: str  # "" when PSI has none


class FileItem(BaseModel):
    """Файл у PSI-99 (індекс `saffire2.test_files`); у знімку лежать лише легкі документи."""

    name: str
    category: str
    kind: str
    mb: float


class SensorStats(BaseModel):
    """Похідне з телеметрії (наші обчислення, у UI — `derived`)."""

    epoch_start_ms: float  # бортовий час першого й останнього відліку запису (epoch, мс)
    epoch_end_ms: float
    ignition_epoch_ms: float | None  # перший відлік зі струмом запальника > 0.5 А
    duration_s: float
    ignition_t_s: float | None
    igniter_on_s: float | None
    peak_sample_t_c: float | None
    peak_plume_t_c: float | None
    co2_start_pct: float | None
    co2_rise_pct: float | None
    o2_mean_pct: float | None
    flow_mean_cm_s: float | None
    flow_sd_cm_s: float | None
    fan_rpm_mean: float | None
    pressure_mean_psia: float | None
    humidity_mean_pct: float | None
    inlet_t_mean_c: float | None
    radiometer_peak_mw_cm2: float | None


class Spread(BaseModel):
    lo: float | None = None  # мм/с; lo == hi для одного числа
    hi: float | None = None
    accelerating: bool = False  # «Acceleratory» у таблиці
    note: str = ""  # джерело діапазону (напр. «Note 4»)


class Sample(BaseModel):
    test_id: str
    material: str
    material_filled_down: bool
    thickness_mm: float | None
    thickness_raw: str
    length_raw: str
    flow_direction: str
    air_flow_cm_s: float | None
    o2_pct_table: float | None
    ignition_power_w: float | None
    ignition_time_s: float | None
    burn_time_s: float | None
    ug_burn_length_raw: str
    g1_burn_length_raw: str
    ug_spread_raw: str
    g1_spread_rate_raw: str
    camera1: str
    camera2: str
    # розібране з таблиці (derived)
    ug_burn_cm: float | None
    g1_burn_cm: float | None
    ug_spread: Spread
    g1_spread: Spread
    verdict: Verdict
    sensors: SensorStats | None


class Co2Track(BaseModel):
    test_id: str
    points: list[tuple[float, float]]  # (хвилини від початку серії, CO₂ %)


class Dashboard(BaseModel):
    about: About
    sample_length_cm: float
    notes: dict[str, str]
    samples: list[Sample]
    co2_timeline: list[Co2Track]
    documents: list[FileItem]  # документи дослідження (без прив'язки до зразка)


class SampleFiles(BaseModel):
    test_id: str
    files: list[FileItem]  # сенсорні xlsx, графіки NASA
    image_archives: int  # zip-архіви кадрів камер у PSI (на сайті не використовуємо)
    image_archives_gb: float


class Series(BaseModel):
    """Телеметрія зразка, колонками. `t` — секунди від запалювання (t_s − ignition_t_s)."""

    test_id: str
    ignition_t_s: float | None
    t: list[float]
    sample_tc: list[list[float | None]]  # 6 рядів, TC7…TC12
    plume_tc: list[list[float | None]]  # 6 рядів, TC1…TC6
    radiometers: list[list[float | None]]  # 4 ряди, мінус базова лінія до запалювання
    radiometer_baseline: list[float | None]
    co2_pct: list[float | None]
    o2_pct: list[float | None]
    igniter_a: list[float | None]
    anemometer_1: list[float | None]
    anemometer_2: list[float | None]
    pressure_psia: list[float | None]
