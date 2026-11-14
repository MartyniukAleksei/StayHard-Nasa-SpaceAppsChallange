# backend — FastAPI (`flame` package)

```bash
uv sync
uv run uvicorn flame.main:app --reload    # http://localhost:8000/api/health, docs: /docs
uv run pytest
uv run ruff check . && uv run ruff format .
```

Див. `../docs/architecture.md` і `../docs/development.md`.
