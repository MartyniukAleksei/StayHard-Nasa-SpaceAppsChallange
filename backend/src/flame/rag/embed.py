"""Ембеддинги для RAG. Одна модель і на збірці (build_db), і в рантаймі (запит).

Модель локальна (fastembed, ONNX, без torch): без ключів і мережі після першого завантаження.
Зміна MODEL_NAME змінює BUILD_VERSION (цей файл у BUILD_SOURCES) → БД перезбереться.
"""

from collections.abc import Sequence
from functools import lru_cache
from typing import Protocol

from flame.core.config import settings

MODEL_NAME = "BAAI/bge-small-en-v1.5"
RERANK_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2"  # cross-encoder, лише в рантаймі пошуку
DIM = 384
# bge рекомендує цей префікс для запитів (не для документів); fastembed його не додає
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


class Embedder(Protocol):
    name: str
    dim: int

    def embed_docs(self, texts: Sequence[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class FastEmbedder:
    name = MODEL_NAME
    dim = DIM

    def __init__(self) -> None:
        from fastembed import TextEmbedding

        self._model = TextEmbedding(MODEL_NAME, cache_dir=str(settings.embed_cache_dir))

    def embed_docs(self, texts: Sequence[str]) -> list[list[float]]:
        return [v.tolist() for v in self._model.embed(list(texts), batch_size=32)]

    def embed_query(self, text: str) -> list[float]:
        return next(iter(self._model.embed([QUERY_PREFIX + text]))).tolist()


class Reranker(Protocol):
    def scores(self, query: str, texts: Sequence[str]) -> list[float]: ...


class FastReranker:
    """Cross-encoder: оцінює пару (запит, текст) разом — точніше за косинус ембеддингів."""

    def __init__(self) -> None:
        from fastembed.rerank.cross_encoder import TextCrossEncoder

        self._model = TextCrossEncoder(RERANK_MODEL, cache_dir=str(settings.embed_cache_dir))

    def scores(self, query: str, texts: Sequence[str]) -> list[float]:
        return [float(s) for s in self._model.rerank(query, list(texts))]


@lru_cache(maxsize=1)
def get_reranker() -> Reranker:
    return FastReranker()


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    """Ледачий синглтон: модель вантажиться при першому запиті, а не при старті API."""
    return FastEmbedder()


if __name__ == "__main__":  # прогрів кешу моделей (Dockerfile)
    print(f"{MODEL_NAME}: dim={len(get_embedder().embed_query('warmup'))}")
    print(f"{RERANK_MODEL}: {get_reranker().scores('warmup', ['warmup'])}")
