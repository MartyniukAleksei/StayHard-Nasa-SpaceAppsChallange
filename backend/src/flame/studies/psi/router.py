"""HTTP: /api/studies/{slug}/… для досліджень із реєстру `flame.core.studies.PSI_STUDIES`.

FLEX має власні ендпоінти (`/api/studies/flex/…`), тому slug `flex` тут — 404.
"""

from typing import Annotated

import duckdb
from fastapi import APIRouter, Depends, HTTPException, Query

from flame.db.duckdb import get_cursor
from flame.studies.psi import service
from flame.studies.psi.repository import InvalidQuery
from flame.studies.psi.schemas import (
    AggregateResult,
    Filter,
    SeriesResult,
    StudyOverview,
    TestDetail,
    TestsResult,
)

router = APIRouter(prefix="/studies/{slug}", tags=["psi-studies"])
Cursor = Annotated[duckdb.DuckDBPyConnection, Depends(get_cursor)]
Filters = Annotated[list[str] | None, Query(description="column:op[:value], e.g. fuel:eq:dodecane")]


def parse_filter(raw: str) -> Filter:
    parts = raw.split(":", 2)
    if len(parts) < 2:
        raise HTTPException(422, f"bad filter {raw!r}; expected column:op[:value]")
    try:
        return Filter(field=parts[0], op=parts[1], value=parts[2] if len(parts) == 3 else None)
    except ValueError as e:
        raise HTTPException(422, f"bad filter {raw!r}: {e}") from e


def _call(fn, *args, **kwargs):  # noqa: ANN001, ANN202
    try:
        return fn(*args, **kwargs)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e
    except InvalidQuery as e:
        raise HTTPException(422, str(e)) from e


@router.get("", response_model=StudyOverview)
def overview(slug: str, cur: Cursor) -> StudyOverview:
    """Реєстр, таблиці, профіль колонок `tests`, часові ряди й примітки до даних."""
    return _call(service.overview, cur, slug)


@router.get("/tests", response_model=TestsResult)
def tests(
    slug: str,
    cur: Cursor,
    f: Filters = None,
    columns: Annotated[
        str | None, Query(description="comma-separated; default: key columns")
    ] = None,
    sort: str | None = None,
    desc: bool = False,
    limit: Annotated[int, Query(ge=1, le=50)] = 50,
) -> TestsResult:
    cols = [c.strip() for c in columns.split(",") if c.strip()] if columns else None
    filters = [parse_filter(x) for x in f or []]
    return _call(service.query_tests, cur, slug, filters, cols, sort, desc, limit)


@router.get("/aggregate", response_model=AggregateResult)
def aggregate(
    slug: str,
    cur: Cursor,
    f: Filters = None,
    group_by: str | None = None,
    metric: str | None = None,
) -> AggregateResult:
    """Кількість тестів (і count/mean/min/max числової колонки `metric`) по групах."""
    filters = [parse_filter(x) for x in f or []]
    return _call(service.aggregate, cur, slug, filters, group_by, metric)


@router.get("/tests/{test_id}", response_model=TestDetail)
def test(slug: str, test_id: str, cur: Cursor) -> TestDetail:
    return _call(service.get_test, cur, slug, test_id)


@router.get("/tests/{test_id}/timeseries/{series}", response_model=SeriesResult)
def timeseries(
    slug: str,
    test_id: str,
    series: str,
    cur: Cursor,
    max_points: Annotated[int, Query(ge=2, le=5000)] = 500,
) -> SeriesResult:
    """Ряд `<slug>.ts_<series>` тесту: статистика колонок і рівномірна вибірка точок."""
    return _call(service.timeseries, cur, slug, test_id, series, max_points)
