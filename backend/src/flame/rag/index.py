"""Офлайн-індекс RAG: таблиця `chunks` + повнотекстовий індекс у flame.duckdb.

Викликається лише з flame.ingest.build_db. Ембеддинги кешуються за хешем тексту чанка:
вектори зі старої БД (тієї ж моделі) перевикористовуються, рахуються лише нові.
"""

import logging
from collections.abc import Iterable
from pathlib import Path

import duckdb

from flame.rag.chunking import Chunk, chunk_document
from flame.rag.embed import Embedder, get_embedder
from flame.rag.sources import Document

log = logging.getLogger(__name__)


def _cached_embeddings(old_db: Path | None, model: str) -> dict[str, list[float]]:
    if old_db is None or not old_db.exists():
        return {}
    try:
        with duckdb.connect(str(old_db), read_only=True) as con:
            meta = dict(con.execute("SELECT key, value FROM meta").fetchall())
            if meta.get("embed_model") != model:
                return {}
            return dict(con.execute("SELECT text_hash, embedding FROM chunks").fetchall())
    except duckdb.Error:
        return {}


def load_fts(con: duckdb.DuckDBPyConnection) -> None:
    """fts у Docker-образі вже встановлено; локально INSTALL качає його один раз."""
    try:
        con.execute("LOAD fts")
    except duckdb.Error:
        con.execute("INSTALL fts")
        con.execute("LOAD fts")


def build(
    con: duckdb.DuckDBPyConnection,
    documents: Iterable[Document],
    old_db: Path | None = None,
    embedder: Embedder | None = None,
) -> dict[str, str]:
    """Створює `chunks` у `con`; повертає записи для таблиці meta."""
    chunks: list[Chunk] = [c for d in documents for c in chunk_document(d)]
    if chunks:
        embedder = embedder or get_embedder()
        model, dim = embedder.name, embedder.dim
    else:  # немає текстів (мінімальний знімок у тестах) — модель не вантажимо
        model = embedder.name if embedder else "none"
        dim = embedder.dim if embedder else 1

    cache = _cached_embeddings(old_db, model) if chunks else {}
    hashes = [c.text_hash(model) for c in chunks]
    missing = [i for i, h in enumerate(hashes) if h not in cache]
    if missing:
        assert embedder is not None
        vectors = embedder.embed_docs([chunks[i].embed_text for i in missing])
        for i, v in zip(missing, vectors, strict=True):
            cache[hashes[i]] = v
    print(
        f"rag: {len(chunks)} chunks, embedded {len(missing)}, reused {len(chunks) - len(missing)}"
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE chunks (
            chunk_id VARCHAR PRIMARY KEY, study VARCHAR, source_type VARCHAR,
            source_path VARCHAR, test_no INTEGER, page INTEGER, title VARCHAR,
            text VARCHAR, search_text VARCHAR, citation VARCHAR, url VARCHAR, text_hash VARCHAR,
            embedding FLOAT[{int(dim)}]
        )
        """
    )
    rows = [
        (
            c.chunk_id, c.study, c.source_type, c.source_path, c.test_no, c.page,
            c.title, c.text, c.embed_text, c.citation, c.url, h, cache[h],
        )
        for c, h in zip(chunks, hashes, strict=True)
    ]  # fmt: skip
    if rows:
        con.executemany("INSERT INTO chunks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
    load_fts(con)
    con.execute("PRAGMA create_fts_index('chunks', 'chunk_id', 'search_text', overwrite=1)")
    return {"embed_model": model, "embed_dim": str(dim), "n_chunks": str(len(chunks))}
