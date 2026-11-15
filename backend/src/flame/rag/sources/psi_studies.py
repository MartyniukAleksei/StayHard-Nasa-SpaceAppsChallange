"""Тексти інших досліджень PSI для RAG: опис і публікації з `data/<slug>/about.json`.

Документи з `docs/` цих досліджень поки не індексуються (сотні МБ PDF, зокрема щоденні
звіти CFI-G): почнемо з опису й публікацій, а PDF додамо, коли знадобиться.
"""

from collections.abc import Iterator
from pathlib import Path

from flame.core.studies import PSI_STUDIES
from flame.rag.sources import Document
from flame.rag.sources.flex import study_about_documents


def iter_documents(data_dir: Path) -> Iterator[Document]:
    for slug, s in PSI_STUDIES.items():
        yield from study_about_documents(data_dir / slug / "about.json", s.accession, s.acronym)
