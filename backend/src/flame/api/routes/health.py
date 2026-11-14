from fastapi import APIRouter
from pydantic import BaseModel

from flame.core.config import settings
from flame.db.duckdb import db_available

router = APIRouter(tags=["health"])


class Health(BaseModel):
    status: str
    env: str
    db: bool
    flex_data: bool


@router.get("/health", response_model=Health)
def health() -> Health:
    return Health(
        status="ok",
        env=settings.env,
        db=db_available(),
        flex_data=(settings.flex_dir / "manifest.json").exists(),
    )
