from flame.core.citations import Source, doi_url, media_url, to_search_result
from flame.core.citations import test_url as build_test_url
from flame.rag.chunking import chunk_document, glossary_terms
from flame.rag.sources import Document


def test_url_builders() -> None:
    assert media_url("PSI-69", "docs/A B.pdf", page=3) == "/api/media/flex/docs/A%20B.pdf#page=3"
    assert build_test_url("PSI-69", 2) == "/api/studies/flex/tests/2"
    assert doi_url("10.1/x") == "https://doi.org/10.1/x"


def test_search_result_block_shape() -> None:
    block = to_search_result(Source(url="/x", title="T", text="body"))
    assert block == {
        "type": "search_result",
        "source": "/x",
        "title": "T",
        "content": [{"type": "text", "text": "body"}],
        "citations": {"enabled": True},
    }


def test_about_and_publication_link_to_doi() -> None:
    about = Document("PSI-69", "about", "about.json", "t", "x", meta={"doi": "10.1/flex"})
    pub = Document(
        "PSI-69", "publication", "about.json", "P", "x",
        meta={"doi": "10.1/flex", "publication_doi": "10.2/pub"},
    )  # fmt: skip
    assert chunk_document(about)[0].url == "https://doi.org/10.1/flex"
    assert chunk_document(pub)[0].url == "https://doi.org/10.2/pub"


def test_glossary_expands_whole_word_abbreviations_only() -> None:
    assert "LLUV = low-light ultraviolet" in glossary_terms("PSI-69", "LLUV data")
    assert glossary_terms("PSI-69", "Helium and HeLLO") == ""  # не «He» всередині слова
    assert glossary_terms("PSI-1", "LLUV") == ""
