"""HTTP: /api/studies — список досліджень для лендінгу."""

from fastapi import APIRouter

from flame.db.duckdb import db_available, get_connection
from flame.studies import catalog
from flame.studies.catalog import StudyCard

router = APIRouter(tags=["studies"])


@router.get("/studies", response_model=list[StudyCard])
def studies() -> list[StudyCard]:
    if not db_available():
        return catalog.list_studies(None)
    cur = get_connection().cursor()
    try:
        return catalog.list_studies(cur)
    finally:
        cur.close()
