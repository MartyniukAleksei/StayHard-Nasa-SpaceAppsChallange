from fastapi import APIRouter
from pydantic import BaseModel

from flame.core.config import settings
from flame.ingest.build_db import read_meta

router = APIRouter(tags=["health"])


class Health(BaseModel):
    status: str
    env: str
    db: bool
    flex_data: bool
    db_build: str | None = None  # build_version з таблиці meta
    dataset: str | None = None  # версія знімка FLEX, з якого зібрано БД


@router.get("/health", response_model=Health)
def health() -> Health:
    meta = read_meta(settings.duckdb_path)
    return Health(
        status="ok",
        env=settings.env,
        db=settings.duckdb_path.exists(),
        flex_data=(settings.flex_dir / "manifest.json").exists(),
        db_build=meta.get("build_version"),
        dataset=meta.get("dataset"),
    )
