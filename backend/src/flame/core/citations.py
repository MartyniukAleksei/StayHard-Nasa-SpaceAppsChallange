"""Контракт джерел: кожен результат, що може потрапити у відповідь агента, несе посилання.

Див. docs/decisions/0005-citation-contract.md. Коротко:
- `Source` — одиниця даних для LLM: `url` (куди веде посилання), `title`, `text` (що саме
  модель може процитувати). Інструменти агента повертають список `Source`.
- `to_search_result` перетворює `Source` у блок `search_result` Claude API з увімкненими
  цитатами: API сам повертає цитати `search_result_location` з `source` = наш `url`
  і дослівним `cited_text`, тож модель не може вигадати посилання.
- `url` — або абсолютний (DOI), або відносний шлях API (`/api/...`), який фронт розв'язує
  через VITE_API_URL. Будувати URL лише функціями з цього модуля.
"""

from typing import Any
from urllib.parse import quote

from pydantic import BaseModel

API_PREFIX = "/api"
STUDY_SLUGS = {"PSI-69": "flex"}  # PSI accession → slug у шляхах API


class Source(BaseModel):
    url: str
    title: str
    text: str


def doi_url(doi: str) -> str:
    return f"https://doi.org/{doi}"


def media_url(study: str, path: str, page: int | None = None) -> str:
    """Файл знімка дослідження (`path` відносно каталогу знімка, напр. raw/002/x.txt)."""
    url = f"{API_PREFIX}/media/{STUDY_SLUGS[study]}/{quote(path)}"
    return f"{url}#page={page}" if page else url


def test_url(study: str, test_no: int) -> str:
    return f"{API_PREFIX}/studies/{STUDY_SLUGS[study]}/tests/{test_no}"


def timeseries_url(study: str, test_no: int, signal: str) -> str:
    return f"{test_url(study, test_no)}/timeseries/{signal}"


def to_search_result(src: Source, citations: bool = True) -> dict[str, Any]:
    """Блок `search_result` для tool_result у Claude Messages API.

    Цитати мають бути увімкнені однаково для всіх блоків у запиті.
    """
    return {
        "type": "search_result",
        "source": src.url,
        "title": src.title,
        "content": [{"type": "text", "text": src.text}],
        "citations": {"enabled": citations},
    }
