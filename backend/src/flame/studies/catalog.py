"""Каталог досліджень PSI для лендінгу: паспорти з catalog.json (flame.ingest.psi_catalog)
+ факти з БД для тих досліджень, дані яких уже є в застосунку."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from duckdb import DuckDBPyConnection
from pydantic import BaseModel

from flame.studies.flex import repository as flex_repo
from flame.studies.flex.schemas import Facts

CATALOG = Path(__file__).with_name("catalog.json")

# Дослідження, які вже мають сторінки й дані: accession → маршрут фронтенду.
ACTIVE: dict[str, str] = {"PSI-69": "/studies/flex"}


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


def list_studies(cur: DuckDBPyConnection | None) -> list[StudyCard]:
    cards = []
    for s in load_catalog():
        route = ACTIVE.get(s["accession"])
        facts = Facts(**flex_repo.get_facts(cur)) if route and cur is not None else None
        cards.append(
            StudyCard(
                **{k: s.get(k, "") for k in StudyCard.model_fields if k in s},
                status="active" if route else "coming_soon",
                route=route,
                facts=facts,
            )
        )
    return cards
