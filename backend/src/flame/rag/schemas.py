from pydantic import BaseModel

from flame.core.citations import Source


class SearchFilters(BaseModel):
    study: str | None = None
    test_nos: list[int] | None = None
    source_types: list[str] | None = None


class Hit(BaseModel):
    """Знайдений чанк. `citation` — готовий рядок для посилання у відповіді агента."""

    chunk_id: str
    study: str
    source_type: str
    source_path: str
    test_no: int | None
    page: int | None
    title: str
    text: str
    citation: str
    url: str  # посилання на джерело (flame.core.citations)
    score: float  # RRF, порівнюваний лише в межах одного запиту
    rerank_score: float | None = None  # cross-encoder; порядок видачі — за ним, якщо є
    vector_rank: int | None = None
    bm25_rank: int | None = None

    def to_source(self) -> Source:
        """Для агента: блок, який Claude API цитує з `source` = `url`."""
        return Source(url=self.url, title=f"{self.citation}", text=self.text)
