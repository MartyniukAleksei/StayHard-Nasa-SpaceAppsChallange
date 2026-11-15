"""HTTP для сторінки Saffire-II: /api/studies/saffire2/{dashboard,samples/{id}/series}."""

from typing import Annotated

from duckdb import DuckDBPyConnection
from fastapi import APIRouter, Depends, HTTPException, Path

from flame.db.duckdb import db_available, get_cursor
from flame.studies.saffire2 import service
from flame.studies.saffire2.schemas import Dashboard, SampleFiles, Series

DATA_NOT_BUILT = (
    "Saffire-II tables are not in the database. Put the snapshot in data/saffire2 and run: "
    "uv run python -m flame.ingest.build_db"
)


def require_db() -> None:
    if not db_available():
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT)


router = APIRouter(
    prefix="/studies/saffire2", tags=["saffire2"], dependencies=[Depends(require_db)]
)
Cursor = Annotated[DuckDBPyConnection, Depends(get_cursor)]
SampleId = Annotated[str, Path(pattern=r"^2-\d$")]


@router.get("/dashboard", response_model=Dashboard)
def dashboard(cur: Cursor) -> Dashboard:
    try:
        return service.get_dashboard(cur)
    except service.StudyDataMissing as e:
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT) from e


@router.get("/samples/{test_id}/series", response_model=Series)
def series(test_id: SampleId, cur: Cursor) -> Series:
    try:
        result = service.get_series(cur, test_id)
    except service.StudyDataMissing as e:
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT) from e
    if result is None:
        raise HTTPException(status_code=404, detail=f"Sample {test_id} not found")
    return result


@router.get("/samples/{test_id}/files", response_model=SampleFiles)
def sample_files(test_id: SampleId, cur: Cursor) -> SampleFiles:
    """Файли зразка в PSI: сенсорні таблиці, графіки NASA; архіви кадрів — лише лічильник."""
    return service.get_sample_files(cur, test_id)
