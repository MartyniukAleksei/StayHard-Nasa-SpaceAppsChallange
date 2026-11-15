"""/api/media/flex/{test_no}/cameras… — кадри камер FLEX з PSI на вимогу.

Ендпоінти синхронні (FastAPI виконує їх у threadpool), бо читання з PSI — блокуючий urllib.
"""

from typing import Annotated

from duckdb import DuckDBPyConnection
from fastapi import APIRouter, Depends, HTTPException, Query, Response

from flame.db.duckdb import get_cursor
from flame.media import psi, service
from flame.media.schemas import CameraOut, CamerasOut, FramesOut

router = APIRouter(prefix="/media/flex", tags=["media"])

Cursor = Annotated[DuckDBPyConnection, Depends(get_cursor)]
_IMMUTABLE = "public, max-age=31536000, immutable"  # дані статичні


def _camera(cur: DuckDBPyConnection, test_no: int, camera: str) -> service.Camera:
    try:
        return service.camera(cur, test_no, camera)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e


@router.get("/{test_no}/cameras", response_model=CamerasOut)
def list_cameras(test_no: int, cur: Cursor) -> CamerasOut:
    """Камери, кадри яких є в PSI для цього тесту. Лише БД, без звернення до PSI."""
    try:
        cams = service.cameras(cur, test_no)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e
    return CamerasOut(
        test_no=test_no,
        cameras=[
            CameraOut(
                camera=c.camera,
                label=c.info.label,
                view=c.info.view,
                psi_file=c.archive.name,
                archive_mb=round(c.archive.bytes / 1e6, 1),
            )
            for c in cams
        ],
    )


@router.get("/{test_no}/cameras/{camera}/frames", response_model=FramesOut)
def list_frames(test_no: int, camera: str, cur: Cursor, response: Response) -> FramesOut:
    """Індекс кадрів камери. Перший виклик для архіву читає з PSI його каталог (~2–3 с)."""
    cam = _camera(cur, test_no, camera)
    try:
        idx = service.frame_index(cam)
    except psi.PsiUnavailable as e:
        raise HTTPException(502, f"NASA PSI unavailable: {e}") from e
    known = [t for t in idx.t_ms if t is not None]
    fps = round((len(known) - 1) / (known[-1] / 1000), 2) if len(known) > 1 and known[-1] else None
    response.headers["Cache-Control"] = _IMMUTABLE
    return FramesOut(
        test_no=test_no,
        camera=cam.camera,
        label=cam.info.label,
        psi_file=cam.archive.name,
        n_frames=len(idx.members),
        start_time=idx.start_time,
        fps=fps,
        t_ms=list(idx.t_ms),
        frame_url=f"/api/media/flex/{test_no}/cameras/{cam.camera}/frames/{{i}}.jpg",
    )


@router.get(
    "/{test_no}/cameras/{camera}/frames/{i}.jpg",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}}}},
)
def get_frame(
    test_no: int,
    camera: str,
    i: int,
    cur: Cursor,
    max_side: Annotated[int | None, Query(ge=64, le=service.MAX_SIDE)] = None,
) -> Response:
    """Один кадр як JPEG (8 біт, фіксоване вікно яскравості на камеру). ~0.5–3 с без кешу."""
    cam = _camera(cur, test_no, camera)
    try:
        jpeg = service.frame_jpeg(cam, i, max_side)
    except service.NotFound as e:
        raise HTTPException(404, str(e)) from e
    except psi.PsiUnavailable as e:
        raise HTTPException(502, f"NASA PSI unavailable: {e}") from e
    return Response(jpeg, media_type="image/jpeg", headers={"Cache-Control": _IMMUTABLE})
