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
| `rag/` | чанкінг, ембеддинги, векторний пошук по таблиці `chunks` |
| `agent/` | LLM-агент та інструменти (`query_tests`, `compare_tests`, `search_docs`, `get_timeseries`, `open_view`) |
| `ingest/` | офлайн-пайплайн: `psi_flex` (PSI → data/flex), `build_db` (data/flex → flame.duckdb). API його не імпортує |

Залежності між шарами: `router → service → repository → db`. `agent` викликає `service`-и доменів і `rag`, а не SQL напряму.

### API (поточний і плановий)
| Метод | Шлях | Стан |
|---|---|---|
| GET | `/api/health` | ✅ `{status, env, db, flex_data}` |
| GET | `/api/studies/flex/overview` | ✅ `{about, facts, presets[]}` — паспорт (з `study_about`), факти, пресети-питання з розкладом за фіналами (лише вільні краплі + скільки виключено через нитку). 503, якщо БД не зібрана |
| GET | `/api/studies/flex/tests/{id}/replay` | ✅ `{test_no, fuel, end_type, burn_time_s, d0_mm, droplet[[t,d]], flame[[t,d]]}`, `t ≥ 0`, ≤ 500 точок. 404 для невідомого тесту |
| GET | `/api/studies/flex/tests?filters` | план |
| GET | `/api/studies/flex/tests/{id}` (+ `/timeseries/{signal}`, `/neighbors`) | план |
| GET | `/api/studies/flex/compare?ids=` | план |
| GET | `/api/media/flex/{test_no}/{path}` | план |
| POST | `/api/agent` (stream) | план |

## Дані — `flame.duckdb`
Збирається `flame.ingest.build_db` з `data/flex`. Зараз містить копію таблиць знімка: `tests`, `test_files`, `ts_droplet`, `ts_flame_color`, `ts_flame_uv`, `ts_chamber` (схема — [data/flex.md §3](data/flex.md)), а також `study_about(study, about JSON)` — вміст `about.json`. Нормалізація при збірці: `tests.test_date` з дворозрядним роком (у джерелі змішані `11/27/09` і `11/27/2009`, тож 50 рядків читались як рік 9–11) переноситься в 20xx.

Похідні прапорці (рахуються в SQL, у UI підписані *derived*): **cool flame** — `ts_comment` відповідає `cool[- ]?flame` (без урахування регістру); **clean** — вільна крапля, не Disruption, є ряди краплі й UV-полум'я. План: таблиця `chunks(id, source, test_no, page, text, embedding FLOAT[N])` для RAG, пошук `array_cosine_similarity` (або індекс розширення `vss`).
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
