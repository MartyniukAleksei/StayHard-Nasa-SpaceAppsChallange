from typing import Annotated

import duckdb
from fastapi import APIRouter, Depends, HTTPException, Query

from flame.db.duckdb import get_cursor
from flame.rag import service
from flame.rag.schemas import Hit, SearchFilters

router = APIRouter(prefix="/rag", tags=["rag"])


@router.get("/search", response_model=list[Hit])
def search(
    cur: Annotated[duckdb.DuckDBPyConnection, Depends(get_cursor)],
    q: Annotated[str, Query(min_length=2, max_length=500)],
    k: Annotated[int, Query(ge=1, le=50)] = 8,
    study: str | None = None,
    test_no: Annotated[list[int] | None, Query()] = None,
    source_type: Annotated[list[str] | None, Query()] = None,
) -> list[Hit]:
    """Гібридний пошук по текстах дослідження (для дебагу й UI; агент кличе service)."""
    filters = SearchFilters(study=study, test_nos=test_no, source_types=source_type)
    try:
        return service.search(cur, q, k, filters)
    except service.IndexNotBuilt as e:
        raise HTTPException(503, str(e)) from e
