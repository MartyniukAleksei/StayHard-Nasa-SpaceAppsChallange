from typing import Annotated

from duckdb import DuckDBPyConnection
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import RedirectResponse

from flame.db.duckdb import db_available, get_connection, get_cursor
from flame.media import psi
from flame.studies.same_r import repository, service
from flame.studies.same_r.schemas import (
    Overview,
    Photos,
    TemOut,
    TestDetail,
    TestList,
    TimeSeries,
)

NOT_BUILT = (
    "SAME-R is not in the database: unpack data-psi-studies-v1 into data/ and run "
    "flame.ingest.build_db (docs/data/psi-studies.md)."
)


def require_samer() -> None:
    """503, поки flame.duckdb немає або в ньому немає схеми samer (знімок не розпаковано)."""
    if not db_available():
        raise HTTPException(503, NOT_BUILT)
    cur = get_connection().cursor()
    try:
        if not repository.available(cur):
            raise HTTPException(503, NOT_BUILT)
    finally:
        cur.close()


router = APIRouter(prefix="/studies/same-r", tags=["same-r"], dependencies=[Depends(require_samer)])
Cursor = Annotated[DuckDBPyConnection, Depends(get_cursor)]


_IMMUTABLE = "public, max-age=31536000, immutable"  # дані статичні


@router.get("/overview", response_model=Overview)
def overview(cur: Cursor) -> Overview:
    return service.get_overview(cur)


@router.get("/psi/{name}", response_class=RedirectResponse, status_code=307)
def psi_file(name: str, cur: Cursor) -> RedirectResponse:
    """Файл PSI-101 з samer.test_files, якого немає в знімку: редирект на підписане S3-посилання."""
    try:
        f = service.psi_file(cur, name)
        return RedirectResponse(psi.signed_url(f["name"], f["version"]), status_code=307)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e
    except psi.PsiUnavailable as e:
        raise HTTPException(502, f"NASA PSI unavailable: {e}") from e


@router.get("/tests", response_model=TestList)
def tests(cur: Cursor) -> TestList:
    return service.list_tests(cur)


@router.get("/tests/{test_no}", response_model=TestDetail)
def test(test_no: int, cur: Cursor) -> TestDetail:
    try:
        return service.get_test(cur, test_no)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e


@router.get("/tests/{test_no}/timeseries/{signal}", response_model=TimeSeries)
def timeseries(
    test_no: int,
    signal: str,
    cur: Cursor,
    # дефолт більший за найдовший ряд (3225 рядків): 1 Гц не проріджується, піки не губляться
    max_points: Annotated[int, Query(ge=10, le=20000)] = 5000,
) -> TimeSeries:
    try:
        return service.get_timeseries(cur, test_no, signal, max_points)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e


@router.get("/tests/{test_no}/tem", response_model=TemOut)
def tem(test_no: int, response: Response, cur: Cursor) -> TemOut:
    """ТЕМ-знімки частинок тесту з PSI (каталоги zip; перший виклик ~1–3 с на архів)."""
    try:
        out = service.get_tem(cur, test_no)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e
    except psi.PsiUnavailable as e:
        raise HTTPException(502, f"NASA PSI unavailable: {e}") from e
    response.headers["Cache-Control"] = _IMMUTABLE
    return out


@router.get(
    "/tests/{test_no}/tem/{k}/{i}.jpg",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}}}},
)
def tem_image(
    test_no: int,
    k: int,
    i: int,
    cur: Cursor,
    max_side: Annotated[int | None, Query(ge=64, le=service.TEM_MAX_SIDE)] = None,
) -> Response:
    try:
        jpeg = service.tem_jpeg(cur, test_no, k, i, max_side)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e
    except psi.PsiUnavailable as e:
        raise HTTPException(502, f"NASA PSI unavailable: {e}") from e
    return Response(jpeg, media_type="image/jpeg", headers={"Cache-Control": _IMMUTABLE})


@router.get("/photos", response_model=Photos)
def photos(response: Response, cur: Cursor) -> Photos:
    """Фото екіпажу з апаратурою SAME-R на МКС (каталог zip з PSI), не прив'язані до тестів."""
    try:
        out = service.get_photos(cur)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e
    except psi.PsiUnavailable as e:
        raise HTTPException(502, f"NASA PSI unavailable: {e}") from e
    response.headers["Cache-Control"] = _IMMUTABLE
    return out


@router.get(
    "/photos/{i}.jpg", response_class=Response, responses={200: {"content": {"image/jpeg": {}}}}
)
def photo(
    i: int, max_side: Annotated[int | None, Query(ge=64, le=service.PHOTO_MAX_SIDE)] = None
) -> Response:
    try:
        jpeg = service.photo_jpeg(i, max_side)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e
    except psi.PsiUnavailable as e:
        raise HTTPException(502, f"NASA PSI unavailable: {e}") from e
    return Response(jpeg, media_type="image/jpeg", headers={"Cache-Control": _IMMUTABLE})
