"""Гібридний пошук: вектор (зміст) + BM25 (ключові слова), злиття Reciprocal Rank Fusion.

Цю функцію агент обгортає як інструмент `search_docs`.
"""

import duckdb

from flame.rag import repository
from flame.rag.embed import Embedder, get_embedder
from flame.rag.schemas import Hit, SearchFilters

CANDIDATES = 30  # скільки кандидатів бере кожен із двох пошуків
RRF_K = 60  # стандартна константа RRF: score = Σ 1 / (RRF_K + rank)


class IndexNotBuilt(RuntimeError):
    pass


def search(
    cur: duckdb.DuckDBPyConnection,
    query: str,
    k: int = 8,
    filters: SearchFilters | None = None,
    embedder: Embedder | None = None,
) -> list[Hit]:
    filters = filters or SearchFilters()
    if not repository.has_chunks(cur):
        raise IndexNotBuilt("chunks table is missing; run flame.ingest.build_db")
    embedder = embedder or get_embedder()

    by_vector = repository.vector_search(cur, embedder.embed_query(query), CANDIDATES, filters)
    by_bm25 = repository.bm25_search(cur, query, CANDIDATES, filters)

    rows: dict[str, dict] = {}
    ranks: dict[str, dict[str, int]] = {}
    for kind, results in (("vector_rank", by_vector), ("bm25_rank", by_bm25)):
        for rank, row in enumerate(results, start=1):
            rows.setdefault(row["chunk_id"], row)
            ranks.setdefault(row["chunk_id"], {})[kind] = rank

    def rrf(cid: str) -> float:
        return sum(1 / (RRF_K + r) for r in ranks[cid].values())

    top = sorted(rows, key=rrf, reverse=True)[:k]
    return [
        Hit(
            **{key: v for key, v in rows[cid].items() if key != "score"},
            score=round(rrf(cid), 6),
            **ranks[cid],
        )
        for cid in top
    ]
