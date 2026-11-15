from typing import Any, Literal

from pydantic import BaseModel, Field


class HistorySource(BaseModel):
    n: int
    url: str = Field(max_length=500)
    title: str = Field(max_length=300)


class HistoryTurn(BaseModel):
    """Одна репліка стислої історії, яку зберігає фронт (sessionStorage)."""

    role: Literal["user", "assistant"]
    text: str = Field(max_length=20000)
    sources: list[HistorySource] = Field(default_factory=list, max_length=50)
    page_context: dict[str, Any] | None = None  # що користувач бачив, коли питав


class AgentRequest(BaseModel):
    messages: list[HistoryTurn] = Field(min_length=1, max_length=60)
