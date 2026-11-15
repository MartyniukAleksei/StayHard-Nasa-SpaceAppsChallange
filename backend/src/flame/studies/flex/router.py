from typing import Annotated

import duckdb
from fastapi import APIRouter, Depends, HTTPException, Query

from flame.db.duckdb import get_cursor
from flame.studies.flex import repository, service
from flame.studies.flex.fields import FIELDS, SIGNALS
from flame.studies.flex.schemas import (
    Comparison,
    FieldsCatalog,
    Filter,
    NeighborsResult,
    TestDetail,
    TestQueryResult,
    TimeSeries,
)

router = APIRouter(prefix="/studies/flex", tags=["flex"])
Cursor = Annotated[duckdb.DuckDBPyConnection, Depends(get_cursor)]


def parse_filter(raw: str) -> Filter:
    """`field:op:value`, напр. `p_atm:lt:0.75`, `fuel:in:Heptane,Methanol`, `dext_mm:is_null`."""
    parts = raw.split(":", 2)
    if len(parts) < 2:
        raise HTTPException(422, f"bad filter {raw!r}; expected field:op[:value]")
    value = parts[2] if len(parts) == 3 else None
    try:
        return Filter(field=parts[0], op=parts[1], value=value)
    except ValueError as e:
        raise HTTPException(422, f"bad filter {raw!r}: {e}") from e


@router.get("/fields", response_model=FieldsCatalog)
def fields() -> FieldsCatalog:
    """Поля, за якими можна фільтрувати й сортувати тести, та доступні сигнали."""
    return FieldsCatalog(fields=list(FIELDS.values()), signals=list(SIGNALS))


@router.get("/tests", response_model=TestQueryResult)
def tests(
    cur: Cursor,
    f: Annotated[list[str] | None, Query(description="field:op[:value]")] = None,
    sort: str = "test_no",
    desc: bool = False,
    limit: Annotated[int, Query(ge=1, le=service.MAX_LIMIT)] = 50,
) -> TestQueryResult:
    filters = [parse_filter(x) for x in f or []]
    try:
        return service.query_tests(cur, filters, sort, desc, limit)
    except repository.InvalidFilter as e:
        raise HTTPException(422, str(e)) from e


@router.get("/tests/{test_no}", response_model=TestDetail)
def test(cur: Cursor, test_no: int) -> TestDetail:
    try:
        return service.get_test(cur, test_no)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e


@router.get("/tests/{test_no}/timeseries/{signal}", response_model=TimeSeries)
def timeseries(
    cur: Cursor,
    test_no: int,
    signal: str,
    max_points: Annotated[int, Query(ge=10, le=20000)] = 2000,
) -> TimeSeries:
    try:
        return service.get_timeseries(cur, test_no, signal, max_points)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e


@router.get("/tests/{test_no}/neighbors", response_model=NeighborsResult)
def neighbors(
    cur: Cursor, test_no: int, k: Annotated[int, Query(ge=1, le=20)] = 5
) -> NeighborsResult:
    try:
        return service.neighbors(cur, test_no, k)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e


@router.get("/compare", response_model=Comparison)
def compare(
    cur: Cursor, ids: Annotated[list[int], Query(min_length=2, max_length=8)]
) -> Comparison:
    try:
        return service.compare_tests(cur, ids)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e
