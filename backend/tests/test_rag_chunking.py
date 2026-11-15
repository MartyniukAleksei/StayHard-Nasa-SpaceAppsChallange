from flame.rag.chunking import chunk_document
from flame.rag.sources import Document


def _doc(text: str, **kw) -> Document:
    base = dict(study="PSI-69", source_type="doc_pdf", source_path="docs/a.pdf", title="A", page=3)
    return Document(text=text, **{**base, **kw})


def test_short_document_is_one_chunk_with_citation() -> None:
    doc = _doc("Droplet burned to extinction.", source_type="testsheet", test_no=2, page=None)
    [c] = chunk_document(doc)
    assert c.chunk_id == "PSI-69:testsheet:docs/a.pdf:2:0"
    assert c.citation.startswith("FLEX-002 TestSheet")
    assert c.embed_text.startswith("[PSI-69 FLEX] A\n")


def test_long_document_splits_with_overlap_and_stable_ids() -> None:
    words = [f"w{i}" for i in range(700)]
    chunks = chunk_document(_doc(" ".join(words)), max_words=300, overlap=40)
    assert len(chunks) == 3
    assert all(len(c.text.split()) <= 340 for c in chunks)
    second = chunks[1].text.split()
    assert second[0] == "w260"  # перші 40 слів — хвіст попереднього чанка
    assert [c.chunk_id for c in chunks] == [
        c.chunk_id for c in chunk_document(_doc(" ".join(words)), max_words=300, overlap=40)
    ]  # noqa: E501
    assert {c.page for c in chunks} == {3}
    assert chunks[0].citation == "A, p. 3 (docs/a.pdf)"


def test_text_hash_depends_on_model() -> None:
    [c] = chunk_document(_doc("abc"))
    assert c.text_hash("m1") != c.text_hash("m2")
