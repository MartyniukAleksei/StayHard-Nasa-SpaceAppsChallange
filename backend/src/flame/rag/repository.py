"""SQL пошуку по таблиці `chunks`. Лише параметризовані запити."""

from typing import Any

import duckdb

from flame.rag.schemas import SearchFilters

COLUMNS = "chunk_id, study, source_type, source_path, test_no, page, title, text, citation, url"


def _where(f: SearchFilters) -> tuple[str, list[Any]]:
    clauses, params = ["TRUE"], []
    if f.study:
        clauses.append("study = ?")
        params.append(f.study)
    if f.test_nos:
        clauses.append("list_contains(?, test_no)")
        params.append(f.test_nos)
    if f.source_types:
        clauses.append("list_contains(?, source_type)")
        params.append(f.source_types)
    return " AND ".join(clauses), params


def _rows(cur: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    names = [d[0] for d in cur.description]
    return [dict(zip(names, r, strict=True)) for r in cur.fetchall()]


def has_chunks(cur: duckdb.DuckDBPyConnection) -> bool:
    q = "SELECT count(*) FROM information_schema.tables WHERE table_name = 'chunks'"
    return cur.execute(q).fetchone()[0] > 0


def embedding_dim(cur: duckdb.DuckDBPyConnection) -> int:
    return int(cur.execute("SELECT value FROM meta WHERE key = 'embed_dim'").fetchone()[0])


def vector_search(
    cur: duckdb.DuckDBPyConnection, qvec: list[float], k: int, f: SearchFilters
) -> list[dict[str, Any]]:
    where, params = _where(f)
    dim = len(qvec)  # тип FLOAT[N] не параметризується; N — довжина нашого ж вектора
    cur.execute(
        f"""
        SELECT {COLUMNS}, array_cosine_similarity(embedding, ?::FLOAT[{dim}]) AS score
        FROM chunks WHERE {where}
        ORDER BY score DESC LIMIT ?
        """,
        [qvec, *params, k],
    )
    return _rows(cur)


def bm25_search(
    cur: duckdb.DuckDBPyConnection, query: str, k: int, f: SearchFilters
) -> list[dict[str, Any]]:
    where, params = _where(f)
    cur.execute("LOAD fts")
    cur.execute(
        f"""
        SELECT * FROM (
            SELECT {COLUMNS}, fts_main_chunks.match_bm25(chunk_id, ?) AS score
            FROM chunks WHERE {where}
        ) WHERE score IS NOT NULL
        ORDER BY score DESC LIMIT ?
        """,
        [query, *params, k],
    )
    return _rows(cur)
