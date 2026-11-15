FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH" DATA_DIR=/data ENV=production MODELS_DIR=/app/models

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
# RAG: моделі ембеддингів і переранжування (= flame.rag.embed.MODEL_NAME / RERANK_MODEL) і DuckDB fts
# запікаються в образ до копіювання коду (кешований шар) — у рантаймі мережа для них не потрібна
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5', cache_dir='/app/models')" \
 && python -c "from fastembed.rerank.cross_encoder import TextCrossEncoder as T; T('Xenova/ms-marco-MiniLM-L-6-v2', cache_dir='/app/models')" \
 && python -c "import duckdb; duckdb.sql('INSTALL fts')"
COPY src ./src
COPY README.md ./
RUN uv sync --frozen --no-dev

EXPOSE 8000
# Railway задає PORT; DATA_DIR=/data — Volume. bootstrap заповнює його при першому старті
CMD ["sh", "-c", "python -m flame.ingest.bootstrap && uvicorn flame.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
