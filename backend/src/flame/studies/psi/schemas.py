from typing import Any, Literal

from pydantic import BaseModel

from flame.core.citations import Source

Op = Literal["eq", "ne", "lt", "lte", "gt", "gte", "in", "contains", "is_null", "not_null"]


class Filter(BaseModel):
    """Умова на колонку `<slug>.tests`. Для `in` — значення через кому."""

    field: str
    op: Op
    value: Any = None


class StudyOverview(BaseModel):
    study: dict[str, Any]  # рядок реєстру `studies`
    tables: dict[str, int]  # таблиця → рядків
    test_columns: list[dict[str, Any]]  # профіль колонок `tests`
    series: dict[str, list[str]]  # ts_<name> → числові колонки
    notes: list[str]
    sources: list[Source]


class TestsResult(BaseModel):
    total: int
    tests: list[dict[str, Any]]
    sources: list[Source]


class AggregateResult(BaseModel):
    groups: list[dict[str, Any]]
    sources: list[Source]


class TestDetail(BaseModel):
    test: dict[str, Any]
    series: dict[str, int]  # ts_<name> → кількість точок цього тесту
    files: list[dict[str, Any]]
    sources: list[Source]


class SeriesResult(BaseModel):
    series: str
    n_points: int
    stats: list[dict[str, Any]]
    points: list[dict[str, Any]]
    sources: list[Source]
