from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from flame.media import service

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/{study}/{path:path}")
def get_file(study: str, path: str) -> FileResponse:
    """Файл знімка (raw/…, docs/…, media/…). Підтримує Range — для PDF і mp4."""
    target = service.resolve(study, path)
    if target is None:
        raise HTTPException(404, "file not found")
    # inline: браузер відкриває PDF/txt/mp4 на місці, а не завантажує
    return FileResponse(target, content_disposition_type="inline", filename=target.name)
