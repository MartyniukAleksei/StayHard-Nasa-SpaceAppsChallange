import json
from pathlib import Path

import duckdb

from flame.rag.sources import flex


def test_testsheet_and_about_documents(tmp_path: Path) -> None:
    with duckdb.connect(str(tmp_path / "flex.duckdb")) as con:
        con.execute(
            """
            CREATE TABLE tests AS SELECT * FROM (VALUES
              (2, '20CAL10', 'Methanol', 1.003, 0.21, 'N2', 'Extinction', false, ' Burns to extinction. '),
              (3, '20CAL12', 'Methanol', 1.0, 0.21, 'N2', 'Disruption', NULL, NULL)
            ) t(test_no, cir_id, fuel, p_atm, x_o2, diluent, end_type, ts_fiber, ts_comment)
            """  # noqa: E501
        )
    about = {
        "doi": "10.1/x",
        "title": "FLEX",
        "objective": "Measure LOI.",
        "hypothesis": "",
        "publications": [{"title": "Paper", "authorList": "A B", "doi": ""}],
    }
    (tmp_path / "about.json").write_text(json.dumps(about))

    docs = list(flex.iter_documents(tmp_path))
    [ts] = [d for d in docs if d.source_type == "testsheet"]
    assert ts.test_no == 2
    assert ts.text.startswith("Test FLEX-002 (CIR 20CAL10): Methanol droplet, 1.00 atm, O2 0.21")
    assert ts.text.endswith("Burns to extinction.")
    kinds = sorted(d.source_type for d in docs)
    assert kinds == ["about", "publication", "testsheet"]  # порожня hypothesis пропущена
    assert all(d.meta["doi"] == "10.1/x" for d in docs if d.source_type != "testsheet")


def test_missing_sources_yield_nothing(tmp_path: Path) -> None:
    with duckdb.connect(str(tmp_path / "flex.duckdb")) as con:
        con.execute("CREATE TABLE tests AS SELECT 1 AS test_no")  # мінімальний знімок
    assert list(flex.iter_documents(tmp_path)) == []


def test_other_studies_about_and_publications(tmp_path: Path) -> None:
    from flame.rag.chunking import chunk_document
    from flame.rag.sources import psi_studies

    d = tmp_path / "cfi"
    d.mkdir()
    about = {
        "doi": "10.60555/m6pj-a914",
        "title": "Cool Flames Investigation",
        "objective": "Study cool flames of droplets.",
        "publications": [{"title": "Cool flame paper", "authorList": "A. B.", "doi": "10.1/x"}],
    }
    (d / "about.json").write_text(json.dumps(about))
    docs = list(psi_studies.iter_documents(tmp_path))
    assert [(x.study, x.source_type) for x in docs] == [
        ("PSI-39", "about"),
        ("PSI-39", "publication"),
    ]
    chunk = chunk_document(docs[0])[0]
    assert chunk.citation == "CFI investigation objective (about.json, DOI 10.60555/m6pj-a914)"
    assert chunk.url == "https://doi.org/10.60555/m6pj-a914"
    assert chunk.embed_text.startswith("[PSI-39 CFI]")


def test_pdfs_only_for_listed_studies_and_skips(tmp_path: Path, monkeypatch) -> None:
    from flame.rag import chunking
    from flame.rag.sources import Document, psi_studies

    def fake_pdfs(study_dir: Path, study: str):
        for name in ("Reports_SAME-R_Final Report.pdf", "SAME_VPRED.pdf"):
            yield Document(study, "doc_pdf", f"docs/x/{name}", name, "text", page=1)

    monkeypatch.setattr(psi_studies, "pdf_documents", fake_pdfs)
    pdfs = [d for d in psi_studies.iter_documents(tmp_path) if d.source_type == "doc_pdf"]
    assert [(d.study, d.title) for d in pdfs] == [("PSI-101", "Reports_SAME-R_Final Report.pdf")]
    assert "P-Trak = condensation particle counter" in chunking.glossary_terms("PSI-101", "P-Trak")
