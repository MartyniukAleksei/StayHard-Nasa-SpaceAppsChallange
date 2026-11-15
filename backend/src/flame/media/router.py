"""HTTP: /api/media/flex/{path} — файли з Volume (PDF, txt, mp4 з підтримкою Range)."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from flame.media import service

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/flex/{rel_path:path}")
def flex_file(rel_path: str) -> FileResponse:
    path = service.resolve_file(rel_path)
    if path is None:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=path.name, content_disposition_type="inline")
