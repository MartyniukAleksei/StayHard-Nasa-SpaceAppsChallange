"""Джерела текстів для RAG, по одному модулю на дослідження (`flex.py` = PSI-69).

Кожен модуль віддає `iter_documents(flex_dir) -> Iterator[Document]`; решта пайплайну спільна.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Document:
    """Одиниця тексту з джерелом, з якої нарізаються чанки."""

    study: str  # PSI accession, напр. "PSI-69"
    source_type: str  # testsheet | doc_pdf | doc_docx | about | publication
    source_path: str  # шлях відносно каталогу знімка дослідження
    title: str
    text: str
    test_no: int | None = None
    page: int | None = None  # 1-based для PDF
    meta: dict[str, str] = field(default_factory=dict)
