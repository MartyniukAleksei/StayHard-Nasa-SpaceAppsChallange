"""Знімок паспортів досліджень PSI для лендінгу (вибір дослідження).

    uv run python -m flame.ingest.psi_catalog

Офлайн: качає /repo/investigations/{ACC} з публічного PSI API і пише стислий
backend/src/flame/studies/catalog.json (кілька KB, комітиться — так доїде на Railway
без зміни архіву даних). API в рантаймі лише читає цей файл.
"""

import json
from pathlib import Path
from typing import Any

from flame.ingest.psi_flex import API, get_json

# Порядок = порядок карток на лендінгу. Перше — активне дослідження з повними даними.
ACCESSIONS = ("PSI-69", "PSI-101", "PSI-39", "PSI-25", "PSI-99", "PSI-107")
OUT = Path(__file__).resolve().parents[1] / "studies" / "catalog.json"


def compact(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "accession": meta["accession"],
        "acronym": meta.get("investigationAcronym") or meta["accession"],
        "title": meta.get("title", ""),
        "doi": meta.get("doi", ""),
        "research_area": meta.get("researchArea", ""),
        "sub_research_area": meta.get("subResearchArea", ""),
        "flight_program": meta.get("flightProgram", ""),
        "objective": meta.get("objective", ""),
        "license": meta.get("licenseIdentifier", ""),
    }


def main() -> None:
    studies = [compact(get_json(f"{API}/repo/investigations/{acc}")) for acc in ACCESSIONS]
    OUT.write_text(json.dumps(studies, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{OUT}: {', '.join(s['acronym'] for s in studies)}")


if __name__ == "__main__":
    main()
