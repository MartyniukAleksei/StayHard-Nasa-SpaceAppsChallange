from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field

from flame.core.citations import Source
from flame.studies.flex.fields import FieldInfo

Op = Literal["eq", "ne", "lt", "lte", "gt", "gte", "in", "is_null", "not_null"]


class Filter(BaseModel):
    """Умова на одне поле з каталогу `fields.FIELDS`."""

    field: str
    op: Op
    value: Any = None  # для `in` — список; для is_null/not_null не потрібне


class TestSummary(BaseModel):
    test_no: int
    cir_id: str | None
    test_date: date | None
    fuel: str | None
    p_atm: float | None
    x_o2: float | None
    x_n2: float | None
    x_co2: float | None
    x_he: float | None
    diluent: str | None
    d0_mm: float | None
    dext_mm: float | None
    k_mm2_s: float | None
    burn_time_s: float | None
    end_type: str | None
    ts_fiber: bool | None
    has_droplet_ts: bool | None
    has_flame_color_ts: bool | None
    has_flame_uv_ts: bool | None
    n_videos: int | None
    fiber_conflict: bool = False  # прапорець нитки суперечить коментарю дослідника
    url: str


class TestQueryResult(BaseModel):
    total: int  # скільки тестів задовольняють фільтри (до limit)
    tests: list[TestSummary]
    sources: list[Source]


class FileRef(BaseModel):
    name: str
    path: str  # відносно каталогу знімка
    bytes: int
    url: str


class TestDetail(BaseModel):
    test: dict[str, Any]  # усі колонки `tests`
    files: list[FileRef]  # локальні файли тесту (raw/NNN, media/NNN)
    url: str
    sources: list[Source]


class TimeSeries(BaseModel):
    test_no: int
    signal: str
    columns: list[str]
    rows: list[list[Any]]
    n_total: int  # точок у БД; `rows` може бути проріджено до max_points
    url: str
    sources: list[Source]


class Neighbor(BaseModel):
    test: TestSummary
    distance: float = Field(description="Computed similarity of conditions (estimate)")


class NeighborsResult(BaseModel):
    test_no: int
    features: list[str]
    neighbors: list[Neighbor]
    note: str
    sources: list[Source]


class FieldDiff(BaseModel):
    field: str
    unit: str | None
    values: dict[int, Any]  # test_no → значення
    diff_vs_first: dict[int, float] | None = None  # лише для чисел


class Comparison(BaseModel):
    test_nos: list[int]
    fields: list[FieldDiff]
    warnings: list[str]
    sources: list[Source]


class FieldsCatalog(BaseModel):
    fields: list[FieldInfo]
    signals: list[str]
