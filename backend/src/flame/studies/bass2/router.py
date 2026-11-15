"""HTTP: /api/studies/bass2/{overview,tests,tests/{id}} і файли знімка /api/media/bass2/files/…"""

from typing import Annotated

from duckdb import DuckDBPyConnection
from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import FileResponse, RedirectResponse

from flame.db.duckdb import db_available, get_cursor
from flame.media import files, psi
from flame.studies.bass2 import service
from flame.studies.bass2.schemas import Overview, TestDetail, TestRow

DATA_NOT_BUILT = (
    "BASS-II data is not in the database. Unpack data-psi-studies-v1 into data/ and run: "
    "uv run python -m flame.ingest.build_db"
)


def require_db() -> None:
    if not db_available():
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT)


router = APIRouter(prefix="/studies/bass2", tags=["bass2"], dependencies=[Depends(require_db)])
media_router = APIRouter(prefix="/media/bass2", tags=["bass2"])

Cursor = Annotated[DuckDBPyConnection, Depends(get_cursor)]
TestId = Annotated[str, Path(pattern=r"^[BFMOPT]\d{1,2}[ab]?$")]


@router.get("/overview", response_model=Overview)
def overview(cur: Cursor) -> Overview:
    try:
        return service.get_overview(cur)
    except service.StudyDataMissing as e:
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT) from e


@router.get("/tests", response_model=list[TestRow])
def tests(cur: Cursor) -> list[TestRow]:
    try:
        return service.list_tests(cur)
    except service.StudyDataMissing as e:
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT) from e


@router.get("/tests/{test_id}", response_model=TestDetail)
def test_detail(test_id: TestId, cur: Cursor) -> TestDetail:
    try:
        result = service.get_test(cur, test_id)
    except service.StudyDataMissing as e:
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT) from e
    if result is None:
        raise HTTPException(status_code=404, detail=f"Test {test_id} not found")
    return result


@router.get("/tests/{test_id}/psi-video/{index}", response_class=RedirectResponse)
def psi_video(test_id: TestId, index: Annotated[int, Path(ge=0)], cur: Cursor) -> RedirectResponse:
    """Редирект на тимчасове посилання S3 (≈1 год): браузер грає відео з NASA напряму, з Range."""
    try:
        url = service.psi_video_url(cur, test_id, index)
    except psi.PsiUnavailable as e:
        raise HTTPException(502, f"NASA PSI unavailable: {e}") from e
    if url is None:
        raise HTTPException(404, f"No PSI video {index} for test {test_id}")
    return RedirectResponse(url, status_code=307, headers={"Cache-Control": "no-store"})


@media_router.get("/files/{path:path}")
def get_file(path: str) -> FileResponse:
    """Файл знімка BASS-II (raw/…, docs/…, media/…) inline, з Range — для PDF і mp4."""
    target = files.resolve("bass2", path)
    if target is None:
        raise HTTPException(404, "file not found")
    return FileResponse(target, content_disposition_type="inline", filename=target.name)
