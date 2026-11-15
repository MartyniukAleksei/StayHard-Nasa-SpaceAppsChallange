"""Pydantic-схеми /api/studies/bass2/*. Фронтенд дзеркалить їх у features/bass2/types.ts."""

from pydantic import BaseModel

from flame.core.citations import Source


class FindingOut(BaseModel):
    id: str
    group: str
    title: str
    value: str
    earth_value: str | None
    text: str
    page: int
    figure: str | None
    source: Source


class CountItem(BaseModel):
    key: str
    label: str
    count: int


class Facts(BaseModel):
    n_tests: int
    n_logged: int  # тестів у журналі Додатку A
    first_year: int
    last_year: int
    n_pi: int
    o2_min_pct: float
    o2_max_pct: float
    n_with_video: int
    by_pi: list[CountItem]
    by_material: list[CountItem]
    by_flow: list[CountItem]  # derived із Додатку A
    by_outcome: list[CountItem]  # derived


class Overview(BaseModel):
    title: str
    acronym: str
    accession: str
    doi: str
    license_name: str
    hypothesis: str
    objective: str
    approach: str
    research_impacts: str
    hardware: str
    citation: str
    facts: Facts
    findings: list[FindingOut]
    sources: list[Source]


class TestRow(BaseModel):
    """Рядок Дослідника: умови з bass2.tests + тип потоку й результат із Додатку A."""

    test_id: str
    pi: str
    test_date: str | None
    gmt_day: int | None
    material: str
    material_class: str  # derived: pmma_film, pmma_slab, pmma_rod, pmma_sphere, fabric, ...
    thickness_mm: float | None  # derived з тексту матеріалу (плівки, пластини)
    diameter_mm: float | None  # derived (стрижні)
    flow_restrictor: int | None
    o2_initial_pct: float | None
    o2_final_pct: float | None
    o2_final_suspect: bool  # фінальний O₂ поза фізичним діапазоном (помилка джерела)
    co2_initial_pct: float | None
    co2_final_pct: float | None
    co_initial_ppm: float | None
    co_final_ppm: float | None
    co_over_range: bool  # у джерелі «OR»/«over»/«>500»
    flow_config: str | None  # derived (Додаток A)
    outcome: str | None  # derived (Додаток A)
    outcome_confidence: str | None
    has_video: bool
    in_report_log: bool


class FileItem(BaseModel):
    name: str
    url: str
    bytes: int
    kind: str


class PsiFile(BaseModel):
    """Файл у PSI, якого немає в знімку (великі відео, архіви кадрів)."""

    name: str
    kind: str
    bytes: int
    version: str


class PsiVideo(BaseModel):
    """Повне відео тесту в PSI: грає в браузері напряму з S3 через `url` (редирект API)."""

    index: int
    name: str
    label: str
    bytes: int
    url: str


class VideoSeries(BaseModel):
    """Ряди з накладки даних на відео PSI (OCR, 1 Гц) — наша оцінка, не дані NASA."""

    psi_video_index: int | None  # який із psi_videos — той самий запис, t_s = час відео
    start_gmt: str
    method: str
    columns: list[str]
    points: list[list[float | None]]


class LogEntry(BaseModel):
    """Рядок журналу Додатку A як у звіті (текст клітинок)."""

    table: str
    report_page: int
    as_run_no: str | None
    date_raw: str | None
    time_raw: str | None
    igniter: str | None
    flow_config: str | None
    flow_config_raw: str | None
    flow_config_derived: bool
    fan_display: str | None
    air_display: str | None
    radiometer_gain: str | None
    o2_raw_initial_pct: str | None
    o2_raw_final_pct: str | None
    observations: str | None
    outcome: str
    outcome_confidence: str
    outcome_note: str | None
    reused_sample: bool


class TestDetail(BaseModel):
    test: TestRow
    sample_no: str | None
    fan_display: str | None
    air_display: str | None
    radiometer_gain: str | None
    total_frames: float | None
    frames_note: str | None
    log: LogEntry | None
    pi_table: dict[str, object] | None  # рядок табл. 5.1 (Miller) або 7.1 (T'ien)
    videos: list[FileItem]
    files: list[FileItem]
    psi_videos: list[PsiVideo]
    psi_files: list[PsiFile]
    video_series: VideoSeries | None
    same_day: list[str]  # інші тести того ж дня GMT
    sources: list[Source]
