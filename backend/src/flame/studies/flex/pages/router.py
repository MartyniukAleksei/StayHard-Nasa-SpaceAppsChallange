"""HTTP для сторінок UI FLEX: /api/studies/flex/{overview,library,explorer},
/tests/{n}/{report,replay,series.csv}.

Агентне API з фільтрами й `sources` (`/tests`, `/tests/{n}`, `/compare`…) —
у flame.studies.flex.router.
"""

from typing import Annotated

from duckdb import DuckDBPyConnection
from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import PlainTextResponse

from flame.db.duckdb import db_available, get_cursor
from flame.studies.flex.pages import service
from flame.studies.flex.pages.schemas import Library, Overview, Replay, TestDetail, TestSummary

DATA_NOT_BUILT = "FLEX database is not built. Run: uv run python -m flame.ingest.build_db"


def require_db() -> None:
    if not db_available():
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT)


router = APIRouter(prefix="/studies/flex", tags=["flex"], dependencies=[Depends(require_db)])

Cursor = Annotated[DuckDBPyConnection, Depends(get_cursor)]
TestNo = Annotated[int, Path(ge=1)]


def _not_found(test_no: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Test {test_no} not found")


@router.get("/overview", response_model=Overview)
def overview(cur: Cursor) -> Overview:
    try:
        return service.get_overview(cur)
    except service.StudyDataMissing as e:
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT) from e


@router.get("/library", response_model=Library)
def library(cur: Cursor) -> Library:
    try:
        return service.get_library(cur)
    except service.StudyDataMissing as e:
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT) from e


@router.get("/explorer", response_model=list[TestSummary])
def tests(cur: Cursor) -> list[TestSummary]:
    return service.list_tests(cur)


@router.get("/tests/{test_no}/report", response_model=TestDetail)
def test_detail(test_no: TestNo, cur: Cursor) -> TestDetail:
    result = service.get_test(cur, test_no)
    if result is None:
        raise _not_found(test_no)
    return result


@router.get("/tests/{test_no}/replay", response_model=Replay)
def replay(test_no: TestNo, cur: Cursor) -> Replay:
    result = service.get_replay(cur, test_no)
    if result is None:
        raise _not_found(test_no)
    return result


@router.get("/tests/{test_no}/series.csv", response_class=PlainTextResponse)
def series_csv(test_no: TestNo, cur: Cursor) -> PlainTextResponse:
    body = service.series_csv(cur, test_no)
    if body is None:
        raise _not_found(test_no)
    return PlainTextResponse(
        body,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="flex-{test_no:03d}-series.csv"'},
    )
