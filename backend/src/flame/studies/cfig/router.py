"""HTTP: /api/studies/cfig/regime — карта режимів ACME CFI-G (PSI-159)."""

from typing import Annotated

from duckdb import DuckDBPyConnection
from fastapi import APIRouter, Depends, HTTPException

from flame.db.duckdb import db_available, get_cursor
from flame.studies.cfig import service
from flame.studies.cfig.schemas import RegimeMap

DATA_NOT_BUILT = (
    "ACME CFI-G (PSI-159) is not in the database. Unpack data-psi-studies-v1 into data/ and run: "
    "uv run python -m flame.ingest.build_db"
)


def require_db() -> None:
    if not db_available():
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT)


router = APIRouter(prefix="/studies/cfig", tags=["cfig"], dependencies=[Depends(require_db)])

Cursor = Annotated[DuckDBPyConnection, Depends(get_cursor)]


@router.get("/regime", response_model=RegimeMap)
def regime(cur: Cursor) -> RegimeMap:
    try:
        return service.get_regime_map(cur)
    except service.StudyDataMissing as e:
        raise HTTPException(status_code=503, detail=DATA_NOT_BUILT) from e
