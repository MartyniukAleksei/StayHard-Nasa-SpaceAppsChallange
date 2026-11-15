"""Тексти FLEX (PSI-69) для RAG: коментарі TestSheet, PDF/DOCX з docs/, about.json.

    uv run python -m flame.rag.sources.flex --dump out.jsonl   # вивантажити й подивитись

Читає лише знімок (`settings.flex_dir`), нічого не пише в data/.
"""

import argparse
import json
import logging
import re
import unicodedata
from collections.abc import Iterator
from pathlib import Path

import duckdb

from flame.core.config import settings
from flame.rag.sources import Document

STUDY = "PSI-69"
LABEL = "FLEX"
MIN_PAGE_CHARS = 40  # сторінки з меншою кількістю тексту (обкладинки, лише графіки) пропускаємо

log = logging.getLogger(__name__)


def flex_doi(flex_dir: Path) -> str:
    about = flex_dir / "about.json"
    if not about.exists():
        return ""
    return json.loads(about.read_text(encoding="utf-8")).get("doi", "")


def _fmt(v: float | None, spec: str) -> str:
    return "n/a" if v is None else format(v, spec)


def testsheet_documents(flex_dir: Path) -> Iterator[Document]:
    """Коментар дослідника з TestSheet, 1 тест = 1 документ, з префіксом умов тесту."""
    db = flex_dir / "flex.duckdb"
    if not db.exists():
        return
    with duckdb.connect(str(db), read_only=True) as con:
        cols = {r[0] for r in con.execute("DESCRIBE tests").fetchall()}
        if "ts_comment" not in cols:
            return
        rows = con.execute(
            """
            SELECT test_no, cir_id, fuel, p_atm, x_o2, diluent, end_type, ts_fiber, ts_comment
            FROM tests
            WHERE ts_comment IS NOT NULL AND trim(ts_comment) <> ''
            ORDER BY test_no
            """
        ).fetchall()
    for test_no, cir, fuel, p_atm, x_o2, diluent, end_type, fiber, comment in rows:
        name = f"FLEX-{test_no:03d}"
        fiber_s = "n/a" if fiber is None else ("yes" if fiber else "no")
        header = (
            f"Test {name} (CIR {cir or 'n/a'}): {fuel or 'n/a'} droplet, "
            f"{_fmt(p_atm, '.2f')} atm, O2 {_fmt(x_o2, '.2f')}, diluent {diluent or 'n/a'}, "
            f"end type {end_type or 'n/a'}, fiber {fiber_s}."
        )
        yield Document(
            study=STUDY,
            source_type="testsheet",
            source_path=f"raw/{test_no:03d}/{name}_TestSheet.txt",
            title=f"{name} TestSheet comment",
            text=f"{header}\n{comment.strip()}",
            test_no=test_no,
        )


def _clean(text: str) -> str:
    text = unicodedata.normalize("NFKC", text.replace("\x00", ""))  # ﬁ → fi
    text = re.sub(r"(?:\s?\.){4,}", " … ", text)  # крапки-заповнювачі змісту
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _doc_title(path: Path) -> str:
    # "Engineering Documents_FLEX_EIRD_v4.pdf" → "FLEX_EIRD_v4"
    stem = path.stem
    prefix = path.parent.name + "_"
    return stem[len(prefix) :] if stem.startswith(prefix) else stem


def pdf_documents(flex_dir: Path) -> Iterator[Document]:
    from pypdf import PdfReader

    for path in sorted((flex_dir / "docs").rglob("*.pdf")):
        rel = path.relative_to(flex_dir).as_posix()
        try:
            reader = PdfReader(path)
        except Exception as e:  # noqa: BLE001 — один битий PDF не має валити збірку
            log.warning("skip %s: %s", rel, e)
            continue
        title = _doc_title(path)
        for i, page in enumerate(reader.pages, start=1):
            try:
                text = _clean(page.extract_text() or "")
            except Exception as e:  # noqa: BLE001
                log.warning("skip %s p.%d: %s", rel, i, e)
                continue
            if len(text) < MIN_PAGE_CHARS:
                continue
            yield Document(STUDY, "doc_pdf", rel, title, text, page=i)


def docx_documents(flex_dir: Path) -> Iterator[Document]:
    """DOCX розбиваємо на розділи за стилями Heading*."""
    from docx import Document as Docx

    for path in sorted((flex_dir / "docs").rglob("*.docx")):
        rel = path.relative_to(flex_dir).as_posix()
        title = _doc_title(path)
        sections: list[tuple[str, list[str]]] = [("", [])]
        for p in Docx(str(path)).paragraphs:
            text = p.text.strip()
            if not text:
                continue
            if p.style is not None and p.style.name.startswith("Heading"):
                sections.append((text, []))
            else:
                sections[-1][1].append(text)
        for section, lines in sections:
            text = _clean("\n".join(lines))
            if len(text) < MIN_PAGE_CHARS:
                continue
            full_title = f"{title} — {section}" if section else title
            yield Document(STUDY, "doc_docx", rel, full_title, text, meta={"section": section})


ABOUT_FIELDS = {
    "objective": "objective",
    "hypothesis": "hypothesis",
    "approach": "approach",
    "description": "description",
    "researchImpacts": "research impacts",
}


def about_documents(flex_dir: Path) -> Iterator[Document]:
    """Опис дослідження з about.json + список публікацій. Кожен несе FLEX DOI."""
    path = flex_dir / "about.json"
    if not path.exists():
        return
    about = json.loads(path.read_text(encoding="utf-8"))
    doi = about.get("doi", "")
    name = about.get("title") or LABEL
    for key, label in ABOUT_FIELDS.items():
        text = _clean(str(about.get(key) or ""))
        if text:
            yield Document(
                STUDY,
                "about",
                "about.json",
                f"{name}: {label}",
                text,
                meta={"field": key, "doi": doi},
            )
    for pub in about.get("publications") or []:
        title = (pub.get("title") or "").strip()
        if not title:
            continue
        authors = (pub.get("authorList") or "").strip()
        pub_doi = (pub.get("doi") or "").strip()
        text = f"Publication from the {LABEL} experiment: {title}. Authors: {authors or 'n/a'}."
        if pub_doi:
            text += f" DOI: {pub_doi}."
        yield Document(
            STUDY,
            "publication",
            "about.json",
            title,
            text,
            meta={"doi": doi, "publication_doi": pub_doi, "authors": authors},
        )


def iter_documents(flex_dir: Path | None = None) -> Iterator[Document]:
    flex_dir = flex_dir or settings.flex_dir
    yield from testsheet_documents(flex_dir)
    yield from about_documents(flex_dir)
    yield from pdf_documents(flex_dir)
    yield from docx_documents(flex_dir)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dump", type=Path, required=True, help="куди писати JSONL")
    args = ap.parse_args()
    stats: dict[str, list[int]] = {}
    with args.dump.open("w", encoding="utf-8") as f:
        for d in iter_documents():
            stats.setdefault(d.source_type, []).append(len(d.text))
            f.write(json.dumps(d.__dict__, ensure_ascii=False) + "\n")
    for kind, lens in stats.items():
        print(f"{kind:12} docs={len(lens):4}  chars={sum(lens):8}  avg={sum(lens) // len(lens)}")


if __name__ == "__main__":
    main()
