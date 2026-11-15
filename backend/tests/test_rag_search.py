from pathlib import Path

import duckdb
import pytest

from flame.rag import index, service
from flame.rag.schemas import SearchFilters
from flame.rag.sources import Document
from tests.rag_fakes import FakeEmbedder

DOCS = [
    Document("PSI-69", "testsheet", "raw/002/t.txt", "FLEX-002 TestSheet comment",
             "The LLUV setting was not optimal so LLUV flame data is unreliable.", test_no=2),
    Document("PSI-69", "testsheet", "raw/045/t.txt", "FLEX-045 TestSheet comment",
             "Heptane droplet disrupted shortly after ignition.", test_no=45),
    Document("PSI-69", "doc_pdf", "docs/plan.pdf", "FLEX_Test_Plan",
             "The limiting oxygen index is determined by decreasing oxygen until no ignition.",
             page=2),
]  # fmt: skip


def _build(path: Path, embedder: FakeEmbedder, old: Path | None = None) -> None:
    with duckdb.connect(str(path)) as con:
        meta = index.build(con, DOCS, old_db=old, embedder=embedder)
        con.execute("CREATE TABLE meta (key VARCHAR, value VARCHAR)")
        con.executemany("INSERT INTO meta VALUES (?, ?)", list(meta.items()))


@pytest.fixture
def cur(tmp_path: Path):
    db = tmp_path / "flame.duckdb"
    _build(db, FakeEmbedder())
    con = duckdb.connect(str(db), read_only=True)
    yield con.cursor()
    con.close()


def test_hybrid_search_ranks_relevant_chunk_first(cur) -> None:
    hits = service.search(cur, "why is LLUV data unreliable", 3, embedder=FakeEmbedder())
    assert hits[0].test_no == 2
    assert hits[0].bm25_rank == 1
    assert hits[0].citation.startswith("FLEX-002 TestSheet")


def test_filters(cur) -> None:
    f = SearchFilters(test_nos=[45])
    hits = service.search(cur, "LLUV data", 5, f, embedder=FakeEmbedder())
    assert {h.test_no for h in hits} == {45}
    f = SearchFilters(source_types=["doc_pdf"], study="PSI-69")
    [hit] = service.search(cur, "oxygen index", 5, f, embedder=FakeEmbedder())
    assert (hit.source_path, hit.page) == ("docs/plan.pdf", 2)
    assert service.search(cur, "oxygen", 5, SearchFilters(study="PSI-1"), FakeEmbedder()) == []


def test_embeddings_are_reused_from_previous_build(tmp_path: Path) -> None:
    old, new = tmp_path / "old.duckdb", tmp_path / "new.duckdb"
    _build(old, FakeEmbedder())
    emb = FakeEmbedder()
    _build(new, emb, old=old)
    assert emb.calls == 0


def test_missing_index_raises(tmp_path: Path) -> None:
    with duckdb.connect(str(tmp_path / "empty.duckdb")) as con:
        with pytest.raises(service.IndexNotBuilt):
            service.search(con.cursor(), "x", embedder=FakeEmbedder())
