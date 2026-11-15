"""Document → Chunk: розбиття тексту на шматки з метаданими й готовою цитатою.

Короткі документи (коментар TestSheet, поле about.json, публікація) — один чанк.
Довгі (сторінка PDF, розділ DOCX) — пакуються абзацами до ~MAX_WORDS слів з overlap.
"""

import hashlib
import re
from dataclasses import dataclass

from flame.core.citations import doi_url, media_url
from flame.rag.sources import Document
from flame.rag.sources import flex as flex_sources

MAX_WORDS = 300  # ≈ 400 токенів; bge-small обрізає після 512
OVERLAP_WORDS = 40

STUDY_LABELS = {"PSI-69": "FLEX"}
GLOSSARIES = {"PSI-69": flex_sources.GLOSSARY}


def glossary_terms(study: str, text: str) -> str:
    """Розшифровки абревіатур, що трапляються в тексті (ціле слово, з урахуванням регістру)."""
    found = [
        f"{abbr} = {full}"
        for abbr, full in GLOSSARIES.get(study, {}).items()
        if re.search(rf"(?<![A-Za-z0-9]){re.escape(abbr)}(?![A-Za-z0-9])", text)
    ]
    return f"\n[terms: {'; '.join(found)}]" if found else ""


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    study: str
    source_type: str
    source_path: str
    test_no: int | None
    page: int | None
    title: str
    text: str
    citation: str
    url: str

    @property
    def embed_text(self) -> str:
        """Текст для ембеддингу й BM25: з міткою дослідження й заголовком."""
        label = STUDY_LABELS.get(self.study, "")
        body = f"{self.title}\n{self.text}"
        return f"[{self.study} {label}] {body}{glossary_terms(self.study, body)}"

    def text_hash(self, model: str) -> str:
        return hashlib.sha256(f"{model}\n{self.embed_text}".encode()).hexdigest()[:32]


def citation(doc: Document) -> str:
    doi = doc.meta.get("doi", "")
    match doc.source_type:
        case "testsheet":
            return f"FLEX-{doc.test_no:03d} TestSheet ({doc.source_path})"
        case "doc_pdf":
            return f"{doc.title}, p. {doc.page} ({doc.source_path})"
        case "about":
            return f"FLEX investigation {doc.meta.get('field', '')} (about.json, DOI {doi})"
        case "publication":
            pub = doc.meta.get("publication_doi", "")
            authors = doc.meta.get("authors", "")
            return f"{authors}. {doc.title}" + (f". DOI {pub}" if pub else f" (via DOI {doi})")
        case _:
            return f"{doc.title} ({doc.source_path})"


def source_url(doc: Document) -> str:
    """Посилання на джерело документа (контракт — flame.core.citations)."""
    match doc.source_type:
        case "about":
            return doi_url(doc.meta["doi"])
        case "publication":
            return doi_url(doc.meta.get("publication_doi") or doc.meta["doi"])
        case _:
            return media_url(doc.study, doc.source_path, doc.page)


def _split(text: str, max_words: int, overlap: int) -> list[str]:
    words = text.split()
    if len(words) <= max_words:
        return [text]
    paras = [p.split() for p in re.split(r"\n\s*\n|\n(?=[•\-–] )", text) if p.strip()]
    # дуже довгі абзаци (сторінка без порожніх рядків) ріжемо по словах
    units: list[list[str]] = []
    for p in paras:
        for i in range(0, len(p), max_words):
            units.append(p[i : i + max_words])
    out: list[str] = []
    cur: list[str] = []
    for u in units:
        if cur and len(cur) + len(u) > max_words:
            out.append(" ".join(cur))
            cur = cur[-overlap:] if overlap else []
        cur.extend(u)
    if cur:
        out.append(" ".join(cur))
    return out


def chunk_document(
    doc: Document, max_words: int = MAX_WORDS, overlap: int = OVERLAP_WORDS
) -> list[Chunk]:
    cite = citation(doc)
    url = source_url(doc)
    loc = f"{doc.test_no}" if doc.test_no is not None else f"{doc.page or 0}"
    section = doc.meta.get("section") or doc.meta.get("field") or ""
    if doc.source_type == "publication":
        section = hashlib.sha1(doc.title.encode()).hexdigest()[:8]
    base = f"{doc.study}:{doc.source_type}:{doc.source_path}:{loc}"
    if section:
        base += f":{section}"
    return [
        Chunk(
            chunk_id=f"{base}:{i}",
            study=doc.study,
            source_type=doc.source_type,
            source_path=doc.source_path,
            test_no=doc.test_no,
            page=doc.page,
            title=doc.title,
            text=part,
            citation=cite,
            url=url,
        )
        for i, part in enumerate(_split(doc.text, max_words, overlap))
    ]
