"""Read-only доступ до flame.duckdb.

БД статична: збирається офлайн (flame.ingest.build_db) і лише читається API.
Кожен запит отримує власний курсор від спільного read-only підключення.
"""

from collections.abc import Iterator
from functools import lru_cache

import duckdb

from flame.core.config import settings


@lru_cache(maxsize=1)
def get_connection() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(settings.duckdb_path), read_only=True)


def get_cursor() -> Iterator[duckdb.DuckDBPyConnection]:
    """FastAPI dependency: `cur: Annotated[DuckDBPyConnection, Depends(get_cursor)]`."""
    cur = get_connection().cursor()
    try:
        yield cur
    finally:
        cur.close()


def db_available() -> bool:
    return settings.duckdb_path.exists()
