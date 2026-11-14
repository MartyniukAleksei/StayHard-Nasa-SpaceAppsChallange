# Розробка

## Вимоги
- Python 3.13 через [uv](https://docs.astral.sh/uv/) · Node 22+ · Docker (для перевірки образів)

## Дані (один раз)
Потрібна тека `data/flex` (≈540 МБ, не в git). Отримати знімок команди — [data/flex.md §4](data/flex.md). Потім:
```bash
cd backend
uv run python -m flame.ingest.psi_flex --verify   # N/N OK
uv run python -m flame.ingest.build_db            # → data/build/flame.duckdb
```

## Запуск
```bash
cd backend && uv sync && uv run uvicorn flame.main:app --reload   # :8000, Swagger на /docs
cd frontend && npm install && npm run dev                         # :5173, /api → :8000
```
Прод-образи разом: `docker compose up --build` (backend :8000, frontend :8080, `./data` монтується як `/data`).
У Claude Code: `.claude/launch.json` має конфіги `backend` і `frontend`.

## Перевірки перед PR
Те саме запускає CI (`.github/workflows/ci.yml`); у `main` — лише через PR із зеленим CI.
```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd frontend && npm run build
```

## Конвенції
**Backend**
- Новий домен/фіча → підпакет у `flame/` з `schemas.py`, `repository.py`, `service.py`, `router.py`; роутер підключити в `flame/api/router.py`.
- SQL лише в `repository.py`, параметризовані запити (`?`), без f-string з вводом користувача.
- Конфіг лише через `flame.core.config.settings`; нові змінні додати в `.env.example`.
- Залежності: `uv add <pkg>` (runtime) / `uv add --dev <pkg>`.
- Тести в `backend/tests/`, `fastapi.testclient.TestClient`.

**Frontend**
- Дані з API — тільки через TanStack Query хуки в `features/<name>/api.ts`, `fetch` — через `shared/api/client.ts`.
- Типи відповідей дзеркалять Pydantic-схеми бекенду.
- Тексти UI англійською.

**Загальне**
- `data/flex` не змінюємо руками; похідні дані — лише скриптами з `flame/ingest`.
- Оновлюй docs разом зі змінами (див. [README.md](README.md)).
