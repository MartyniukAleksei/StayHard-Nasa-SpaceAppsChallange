"""Каталог досліджень PSI для лендінгу: паспорти з catalog.json (flame.ingest.psi_catalog)
+ факти з БД для тих досліджень, дані яких уже є в застосунку."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from duckdb import DuckDBPyConnection
from pydantic import BaseModel

from flame.studies.flex.pages import repository as flex_repo
from flame.studies.flex.pages.schemas import Facts

CATALOG = Path(__file__).with_name("catalog.json")

# Дослідження, які вже мають сторінки й дані: accession → маршрут фронтенду.
ACTIVE: dict[str, str] = {
    "PSI-69": "/studies/flex",
    "PSI-101": "/studies/same-r",
    "PSI-99": "/studies/saffire2",
    "PSI-25": "/studies/bass2",
}


class StudyCard(BaseModel):
    accession: str
    acronym: str
    title: str
    doi: str
    research_area: str
    sub_research_area: str
    flight_program: str
    objective: str
    status: str  # "active" | "coming_soon"
    route: str | None
    facts: Facts | None


@lru_cache(maxsize=1)
def load_catalog() -> tuple[dict[str, Any], ...]:
    return tuple(json.loads(CATALOG.read_text(encoding="utf-8")))


def _facts(accession: str, cur: DuckDBPyConnection) -> Facts | None:
    """Факти для картки: у FLEX — палива й розбавники; у BASS-II — матеріали зразків."""
    if accession == "PSI-69":
        return Facts(**flex_repo.get_facts(cur))
    if accession == "PSI-25":
        from flame.studies.bass2 import service as bass2

        try:
            f = bass2.get_overview(cur).facts
        except bass2.StudyDataMissing:
            return None
        return Facts(
            n_tests=f.n_tests,
            fuels=[m.label for m in f.by_material],
            diluents=["N2"],
            first_year=f.first_year,
            last_year=f.last_year,
        )
    return None


def list_studies(cur: DuckDBPyConnection | None) -> list[StudyCard]:
    cards = []
    for s in load_catalog():
        route = ACTIVE.get(s["accession"])
        # факти з БД: FLEX і BASS-II; SAME-R поки читає знімок (studies/same_r)
        facts = _facts(s["accession"], cur) if route and cur is not None else None
        cards.append(
            StudyCard(
                **{k: s.get(k, "") for k in StudyCard.model_fields if k in s},
                status="active" if route else "coming_soon",
                route=route,
                facts=facts,
            )
        )
    # відкриті дослідження першими: їхні картки на всю ширину, і сітка «скоро» не рветься
    return sorted(cards, key=lambda c: c.status != "active")
