from typing import Any

from pydantic import BaseModel

from flame.core.citations import Source


class TestList(BaseModel):
    # усі колонки tests.csv + ptrak_peak_per_cc, active_detectors, has_tem
    tests: list[dict[str, Any]]
    sources: list[Source]


class FileItem(BaseModel):
    name: str
    title: str
    url: str  # локальна копія (/api/media/samer/files/…) або редирект на PSI (/psi/{name})
    bytes: int
    category: str
    local: bool  # є у знімку на диску


class TestDetail(BaseModel):
    test_no: int
    rows: list[dict[str, Any]]  # рядок N і, якщо є, Na (той самий дим після витримки)
    coverage: dict[str, Any] | None  # з ts_sensors: діапазон t_s, пік P-Trak, активні детектори
    tem_archives: list[dict[str, Any]]  # zip з ТЕМ-знімками прогону (samer.test_files)
    files: list[FileItem]  # усі файли прогону в PSI (телеметрія, xls аналізу, pptx/pdf з ТЕМ)
    url: str
    sources: list[Source]


class TimeSeries(BaseModel):
    """Та сама форма, що у FLEX (`studies/flex/schemas.py`)."""

    test_no: int
    signal: str
    columns: list[str]
    rows: list[list[Any]]
    n_total: int  # точок у знімку; `rows` може бути проріджено до max_points
    url: str
    sources: list[Source]


class DocGroup(BaseModel):
    category: str
    files: list[FileItem]


class Overview(BaseModel):
    acronym: str
    title: str
    accession: str
    doi: str | None
    objective: str
    hypothesis: str
    flight_program: str
    start_date: str
    end_date: str
    documents: list[DocGroup]
    sources: list[Source]


class TemImage(BaseModel):
    name: str
    url: str


class TemArchive(BaseModel):
    psi_file: str
    sample_id: str | None
    aging: str | None
    images: list[TemImage]


class TemOut(BaseModel):
    test_no: int
    archives: list[TemArchive]
    sources: list[Source]


class Photos(BaseModel):
    """Фото екіпажу МКС з апаратурою SAME-R (Expedition 23–24), не прив'язані до тестів."""

    psi_file: str
    images: list[TemImage]
    sources: list[Source]
