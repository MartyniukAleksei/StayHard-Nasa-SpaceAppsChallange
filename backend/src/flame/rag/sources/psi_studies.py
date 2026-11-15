"""Тексти інших досліджень PSI для RAG: опис і публікації з `data/<slug>/about.json`, а для
досліджень з `PDF_STUDIES` — ще й PDF з `docs/` посторінково.

PDF додаємо по одному дослідженню, з перевіркою якості (evalsets/<accession>.jsonl): у деяких
знімках сотні МБ PDF (щоденні звіти CFI-G), і вони розмили б пошук та подовжили збірку на проді.
"""

from collections.abc import Iterator
from pathlib import Path

from flame.core.studies import PSI_STUDIES
from flame.rag.sources import Document
from flame.rag.sources.flex import pdf_documents, study_about_documents

# slug → підрядки імен PDF, які не індексуємо
PDF_STUDIES: dict[str, tuple[str, ...]] = {
    "samer": ("VPRED",),  # матриця вимог до ЕМС, 107 сторінок таблиць — шум для пошуку
}

# Абревіатури домену → розшифровка (лише для пошуку, не для цитованого тексту), як flex.GLOSSARY.
GLOSSARIES: dict[str, dict[str, str]] = {
    "PSI-101": {
        "SAME": "Smoke Aerosol Measurement Experiment",
        "MSG": "Microgravity Science Glovebox",
        "P-Trak": "condensation particle counter (particle number concentration)",
        "DustTrak": "light-scattering aerosol monitor (smoke mass concentration)",
        "STS": "Space Shuttle ionization smoke detector",
        "TEM": "transmission electron microscope (particle images)",
        "CMD": "count median diameter of particles",
        "HKP": "housekeeping telemetry",
        "EIRD": "Experiment Integration Requirements Document",
        "PTFE": "Teflon",
        "CPC": "condensation particle counter",
    },
}


def iter_documents(data_dir: Path) -> Iterator[Document]:
    for slug, s in PSI_STUDIES.items():
        yield from study_about_documents(data_dir / slug / "about.json", s.accession, s.acronym)
        if slug in PDF_STUDIES:
            skip = PDF_STUDIES[slug]
            yield from (
                d
                for d in pdf_documents(data_dir / slug, s.accession)
                if not any(x in d.source_path for x in skip)
            )
