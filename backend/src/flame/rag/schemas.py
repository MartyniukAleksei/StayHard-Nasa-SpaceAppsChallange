from pydantic import BaseModel


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
    score: float  # RRF, порівнюваний лише в межах одного запиту
    vector_rank: int | None = None
    bm25_rank: int | None = None
