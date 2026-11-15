# Архітектура

## Огляд
```
NASA PSI API ──(офлайн: flame.ingest.psi_flex)──► data/flex/            знімок FLEX, read-only
                                                     │ (flame.ingest.build_db)
                                                     ▼
                                              data/build/flame.duckdb   таблиці + ряди + RAG-чанки
                                                     │ read-only
 frontend (React SPA) ──HTTP /api──► backend (FastAPI, пакет `flame`) ──► DuckDB
                                                     └──► файли raw/pdf/mp4 з $DATA_DIR/flex
                                                     └──► LLM (агент)
```
- Дані **статичні**: після збору з PSI не змінюються. Історії чатів не зберігаємо. Тому немає серверної БД — лише read-only файл DuckDB ([ADR 0001](decisions/0001-duckdb-single-file.md)).
- Важкі файли й БД лежать на **Railway Volume**, змонтованому в бекенд як `/data` ([ADR 0002](decisions/0002-railway-volume-media.md)).
- Монорепо: `frontend/` і `backend/` — окремі Docker-образи й окремі Railway-сервіси ([ADR 0003](decisions/0003-monorepo-layout.md)).

## Репозиторій
```
backend/   FastAPI, uv, src-layout: src/flame/…
frontend/  React + Vite + TS
docs/      ця документація
data/      (gitignored) flex/ — джерело, build/ — згенерована БД
docker-compose.yml  локальний запуск прод-образів
```

## Backend — `backend/src/flame/`
| Модуль | Відповідальність |
|---|---|
| `main.py` | `create_app()`: CORS, підключення роутерів |
| `core/config.py` | `Settings` (pydantic-settings, env). **Усі шляхи до даних тільки звідси**: `data_dir`, `flex_dir`, `duckdb_path` |
| `db/duckdb.py` | read-only підключення; FastAPI-dependency `get_cursor` |
| `api/router.py` | префікс `/api`, збирає роутери модулів; `api/routes/` — службові (health) |
| `studies/flex/` | домен FLEX: `schemas` → `repository` (SQL) → `service` (логіка) → `router` (HTTP) |
| `media/` | віддача файлів тесту з Volume |
| `rag/` | джерела текстів (`sources/<study>.py`), чанкінг, локальні ембеддинги, офлайн-індекс `chunks` (`index.py`, кличе `build_db`), гібридний пошук vector + BM25 ([docs/rag/](rag/techstack.md)) |
| `agent/` | LLM-агент та інструменти (`query_tests`, `compare_tests`, `search_docs`, `get_timeseries`, `open_view`) |
| `ingest/` | офлайн-пайплайн: `psi_flex` (PSI → data/flex), `build_db` (data/flex → flame.duckdb). API його не імпортує |

Залежності між шарами: `router → service → repository → db`. `agent` викликає `service`-и доменів і `rag`, а не SQL напряму.

### API (поточний і плановий)
| Метод | Шлях | Стан |
|---|---|---|
| GET | `/api/health` | ✅ `{status, env, db, flex_data}` |
| GET | `/api/rag/search?q=&k=&study=&test_no=&source_type=` | ✅ гібридний пошук по текстах |
| GET | `/api/studies/flex/tests?filters` | план |
| GET | `/api/studies/flex/tests/{id}` (+ `/timeseries/{signal}`, `/neighbors`) | план |
| GET | `/api/studies/flex/compare?ids=` | план |
| GET | `/api/media/flex/{test_no}/{path}` | план |
| POST | `/api/agent` (stream) | план |

## Дані — `flame.duckdb`
Збирається `flame.ingest.build_db` з `data/flex`. Зараз містить копію таблиць знімка: `tests`, `test_files`, `ts_droplet`, `ts_flame_color`, `ts_flame_uv`, `ts_chamber` (схема — [data/flex.md §3](data/flex.md)). Також таблиця `chunks` (RAG): тексти з метаданими й цитатою, `embedding FLOAT[384]` (`bge-small-en-v1.5`) і FTS-індекс; пошук `array_cosine_similarity` + BM25 зі злиттям RRF ([rag/techstack.md](rag/techstack.md), [ADR 0004](decisions/0004-rag-local-embeddings.md)). Ембеддинги перевикористовуються зі старої БД за хешем тексту.
**БД не редагується — перезбирається.** Будь-яка обробка даних = код у `build_db` (або модулі з `BUILD_SOURCES`). Версія збірки (хеш цього коду) пишеться в таблицю `meta`; `flame.ingest.bootstrap` перезбирає БД локально й на проді, коли версія змінилась (деталі — [deployment.md](deployment.md)). Сирий знімок змінюється лише новим релізом `data-flex-vN`.

Правило: числа в UI і відповідях агента — тільки з цієї БД; все, що рахуємо самі (fit K тощо), позначаємо як оцінку.

## Frontend — `frontend/src/`
| Тека | Що |
|---|---|
| `app/` | `App`, `router.tsx` (react-router), `providers.tsx` (TanStack Query) |
| `pages/` | тонкі сторінки, лише компонують фічі |
| `features/<name>/` | модуль фічі: `api.ts`, `types.ts`, `components/`, `index.ts` (публічний експорт) |
| `shared/` | `api/client.ts` (fetch до `/api`), `ui/`, `lib/`, `styles/` |
Імпорти через alias `@/`. Фічі не імпортують одна одну всередину — тільки через `index.ts`.

## Деплой
Railway: сервіси `backend` (root `backend/`, Volume `/data`) і `frontend` (root `frontend/`, nginx). Див. [deployment.md](deployment.md).
