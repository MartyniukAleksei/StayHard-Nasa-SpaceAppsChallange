# Архітектура

## Огляд
```
NASA PSI API ──(офлайн: flame.ingest.psi_flex)──► data/flex/            знімок FLEX, read-only
             ──(офлайн; реліз data-psi-studies-v1)─► data/{cfi,cfig,bass2,samer,saffire2}/  інші дослідження
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
data/      (gitignored) flex/, cfi/, cfig/, bass2/, samer/, saffire2/ — джерела, build/ — згенерована БД
docker-compose.yml  локальний запуск прод-образів
```

## Backend — `backend/src/flame/`
| Модуль | Відповідальність |
|---|---|
| `main.py` | `create_app()`: CORS, підключення роутерів |
| `core/config.py` | `Settings` (pydantic-settings, env). **Усі шляхи до даних тільки звідси**: `data_dir`, `flex_dir`, `duckdb_path` |
| `db/duckdb.py` | read-only підключення; FastAPI-dependency `get_cursor` |
| `api/router.py` | префікс `/api`, збирає роутери модулів; `api/routes/` — службові (health) |
| `core/citations.py` | контракт джерел: `Source(url, title, text)`, побудова URL, `to_search_result` для Claude API ([ADR 0006](decisions/0006-citation-contract.md)) |
| `studies/` | `catalog.py` + `catalog.json` (паспорти досліджень PSI, генерує `flame.ingest.psi_catalog`), `router.py` — `/api/studies` |
| `studies/flex/` | домен FLEX: `fields` (whitelist полів і сигналів) → `schemas` → `repository` (SQL) → `service` (логіка, `sources` у кожному результаті) → `router` (HTTP) — агентне API з фільтрами; `pages/` — відповіді під сторінки UI (огляд, дослідник, звіт тесту, replay, CSV, бібліотека) |
| `media/` | кадри камер з PSI на вимогу (`psi.py`: Range-читання zip з S3; `service.py`: індекс кадрів, 16-біт → JPEG), [ADR 0005](decisions/0005-psi-frames-proxy.md); `files.py`: файли знімка (`raw/`, `docs/`, `media/`) з Volume із захистом від виходу за межі каталогу — на ці URL ведуть посилання-джерела; там же переліки файлів тесту, відео й NASA-документів для UI; `timing.py`: час кадру від запалювання (з логу тест-пойнта) для агента |
| `rag/` | джерела текстів (`sources/<study>.py`), чанкінг, локальні ембеддинги, офлайн-індекс `chunks` (`index.py`, кличе `build_db`), гібридний пошук vector + BM25 ([docs/rag/](rag/techstack.md)) |
| `agent/` | LLM-агент (Claude Sonnet 5.5; фронтенд — `frontend/src/features/agent`, бічна панель чату): інструменти даних над `studies/flex` і `rag`, цикл зі стрімінгом SSE, цитати й «No source», ліміти, eval ([docs/agent/](agent/README.md), [ADR 0007](decisions/0007-agent-architecture.md)) |
| `ingest/replay3d_coverage.py` | офлайн-звіт: у яких тестів є дані для 3D replay (`uv run python -m flame.ingest.replay3d_coverage [--missing]`) |
| `ingest/` | офлайн-пайплайн: `psi_flex` (PSI → data/flex), `psi_cfi` (PSI → data/cfi), `psi_studies` (знімки інших досліджень → схеми БД, `--verify`), `build_db` (data/* → flame.duckdb), `bootstrap` (архіви релізів → Volume). API його не імпортує |

Залежності між шарами: `router → service → repository → db`. `agent` викликає `service`-и доменів і `rag`, а не SQL напряму.

### API (поточний і плановий)

UI-ендпоінти (`studies/flex/pages`) повертають 503, якщо БД не зібрана.

| Метод | Шлях | Стан |
|---|---|---|
| GET | `/api/health` | ✅ `{status, env, db, flex_data}` |
| GET | `/api/rag/search?q=&k=&study=&test_no=&source_type=` | ✅ гібридний пошук по текстах |
| GET | `/api/studies/flex/fields` | ✅ каталог полів для фільтрів і сигналів |
| GET | `/api/studies/flex/tests?f=field:op:value&sort=&desc=&limit=` | ✅ фільтри (`eq ne lt lte gt gte in is_null not_null`), `sources` |
| GET | `/api/studies/flex/tests/{n}` | ✅ усі колонки + локальні файли + джерела (таблиця, TestSheet) |
| GET | `/api/studies/flex/tests/{n}/timeseries/{signal}?max_points=` | ✅ `droplet`, `flame_color`, `flame_uv`, `chamber`; проріджування зі збереженням останньої точки |
| GET | `/api/studies/flex/tests/{n}/neighbors?k=` | ✅ найближчі за умовами (те саме паливо й тип краплі; оцінка) |
| GET | `/api/studies/flex/compare?ids=&ids=` | ✅ детермінований diff + попередження (нитка, паливо, Disruption, пропуски) |
| GET | `/api/media/flex/{test_no}/cameras` | ✅ камери з кадрами в PSI (`A` HiBMS, `B` LLL-UV, `D` колір), лише БД |
| GET | `/api/media/flex/{test_no}/cameras/{camera}/frames` | ✅ `{n_frames, fps, start_time, t_ms[], frame_url}`, перший виклик ~3–6 с |
| GET | `/api/media/flex/{test_no}/cameras/{camera}/frames/{i}.jpg?max_side=` | ✅ JPEG одного кадру, ~1–2 с без кешу |
| GET | `/api/media/flex/files/{path}` | ✅ файли знімка (`raw/…`, `docs/…`, `media/…`), inline, Range |
| GET | `/api/studies` | ✅ картки досліджень для лендінгу: паспорт з `studies/catalog.json` (PSI-69 FLEX, PSI-39 CFI, PSI-25 BASS-II, PSI-99 SAFFIRE-II, PSI-107 SPICE, PSI-102 SAME) + `status` (`active`/`coming_soon`), `route`, `facts` (лише для активних, з БД) |
| GET | `/api/studies/flex/overview` | ✅ UI: `{about, facts, presets[]}` — паспорт (з `study_about`), факти, пресети-питання з розкладом за фіналами (лише вільні краплі + скільки виключено через нитку) |
| GET | `/api/studies/flex/explorer` | ✅ UI: усі 274 рядки Дослідника (фільтрація — на фронтенді, стан у URL). `has_series` = є ряди краплі **і** UV-полум'я; `has_3d` = є ряд краплі (досить для 3D replay); `has_video` = є локальний mp4; `cool_flame` — *derived* |
| GET | `/api/studies/flex/tests/{n}/report` | ✅ UI, сторінка тесту 3A: паспорт + `neighbors` (5 схожих: те саме паливо, розбавник і клас нитки, найближчі за O₂, тиском і d₀; *derived*) + `files` + `videos` + `has_3d` |
| GET | `/api/studies/flex/tests/{n}/replay` | ✅ UI: `{test_no, fuel, end_type, burn_time_s, d0_mm, droplet[[t,d]], flame[[t,d]]}`, `t ≥ 0`, ≤ 500 точок |
| GET | `/api/studies/flex/tests/{n}/series.csv` | ✅ усі точки рядів (`signal,t_s,value`), у першому рядку — цитата з DOI |
| GET | `/api/studies/flex/videos` | ✅ UI: усі mp4 камер NASA (PSI FLEX) з умовами тесту (`test_no, fuel, diluent, x_o2, p_atm, end_type, name, path`) — галерея на Огляді |
| GET | `/api/studies/flex/library` | ✅ UI: цитата, DOI, ліцензія, публікації, документи NASA за категоріями, `limitations` (лічильники з БД) |
| GET | `/api/studies/bass2/overview` | ✅ UI BASS-II: паспорт (`study_about`), факти з `bass2.tests` + розклади за PI, класом матеріалу, типом потоку й результатом (*derived*), `findings` — ключові числа звіту NASA/TM-20210011385 із номерами сторінок і `source` |
| GET | `/api/studies/bass2/tests` | ✅ UI: 129 рядків Дослідника BASS-II: умови з `bass2.tests` + `flow_config`/`outcome` з Додатку A (*derived*), клас матеріалу, товщина/діаметр (*derived*), прапорці помилок джерела (`o2_final_suspect`, `co_over_range`) |
| GET | `/api/studies/bass2/tests/{id}` | ✅ UI: рядок + журнал Додатку A (спостереження), рядок табл. 5.1/7.1 PI, локальні mp4/PDF, `psi_videos` (повні записи в PSI), тести того ж дня, `sources` |
| GET | `/api/studies/bass2/tests/{id}/psi-video/{i}` | ✅ 307 на тимчасове посилання S3 PSI (~1 год): браузер грає повне відео тесту з NASA напряму, з Range |
| GET | `/api/media/bass2/files/{path}` | ✅ файли знімка `data/bass2` (`raw/…`, `docs/…`, `media/…`), inline, Range |
| POST | `/api/agent` | ✅ SSE: `text_delta`, `status`, `limit`, `done` (відповідь із сегментами й джерелами) — [docs/agent](agent/README.md) |

## Дані — `flame.duckdb`
Збирається `flame.ingest.build_db` з `data/flex` і знімків інших досліджень. **FLEX** лежить у схемі `main` — копія таблиць знімка: `tests`, `test_files`, `ts_droplet`, `ts_flame_color`, `ts_flame_uv`, `ts_chamber` (схема — [data/flex.md §3](data/flex.md)), а також `study_about(study, about JSON)` — вміст `about.json`. Нормалізація при збірці: `tests.test_date` з дворозрядним роком (у джерелі змішані `11/27/09` і `11/27/2009`, тож 50 рядків читались як рік 9–11) переноситься в 20xx. Також таблиця `chunks` (RAG): тексти з метаданими й цитатою, `embedding FLOAT[384]` (`bge-small-en-v1.5`) і FTS-індекс; пошук `array_cosine_similarity` + BM25 зі злиттям RRF ([rag/techstack.md](rag/techstack.md), [ADR 0004](decisions/0004-rag-local-embeddings.md)). Ембеддинги перевикористовуються зі старої БД за хешем тексту.
**Інші дослідження** (CFI, ACME CFI-G, BASS-II, SAME-R, Saffire-II) — кожне в своїй схемі (`cfi.tests`, `cfig.ts_telemetry`, …), таблиці 1:1 з `data/<slug>/<slug>.duckdb` без нормалізації; схема `flex` — view на таблиці FLEX у `main`. Реєстр `studies` (slug, accession, DOI, ключ тесту, таблиці), `meta.datasets` — версії знімків. Знімка, якого немає на диску, у збірці просто немає. Опис і приклади запитів — [data/psi-studies.md](data/psi-studies.md), рішення — [ADR 0008](decisions/0008-multi-study-db.md). API, RAG і агент поки працюють лише з FLEX.
**БД не редагується — перезбирається.** Будь-яка обробка даних = код у `build_db` (або модулі з `BUILD_SOURCES`). Версія збірки (хеш цього коду) пишеться в таблицю `meta`; `flame.ingest.bootstrap` перезбирає БД локально й на проді, коли версія змінилась (деталі — [deployment.md](deployment.md)). Сирий знімок змінюється лише новим релізом (`data-flex-vN`, `data-psi-studies-vN`).

Похідні прапорці для UI (рахуються в SQL, у UI підписані *derived*): **cool flame** — `ts_comment` відповідає `cool[- ]?flame` (без урахування регістру); **clean** — вільна крапля, не Disruption, є ряди краплі й UV-полум'я.

Правило: числа в UI і відповідях агента — тільки з цієї БД; все, що рахуємо самі (fit K тощо), позначаємо як оцінку.

## Frontend — `frontend/src/`
| Тека | Що |
|---|---|
| `app/` | `App`, `router.tsx` (react-router), `providers.tsx` (TanStack Query) |
| `pages/` | тонкі сторінки, лише компонують фічі |
| `features/<name>/` | модуль фічі: `api.ts`, `types.ts`, `components/`, `index.ts` (публічний експорт) |
| `shared/` | `api/client.ts` (fetch до `/api`), `ui/` (`CopyButton`, `Placeholder`, `EndMark`, `chart/TimeChart`), `lib/` (`format`, `useWidth`), `styles/` (токени StayHard) |

Маршрути і фічі:

| Маршрут | Сторінка (макет) | Фіча |
|---|---|---|
| `/` | лендінг, вибір дослідження | `features/landing` (ASCII-небо, `StudyCards` з `/api/studies`) |
| `/studies/flex` | Огляд 1A | `features/study-overview` (+ `replay`) |
| `/studies/flex/tests` | Дослідник 2B | `features/explorer` (фасети, стан у URL; пресети Огляду ведуть сюди через `presetHref`) |
| `/studies/flex/tests/:id` | Тест 3A | `features/test-page` (+ `replay`, `experiment-3d`: вкладка «3D replay» у блоці Watch) |
| `/studies/flex/compare?ids=` | Порівняння 4A | `features/compare` (≤ 3 тести) |
| `/studies/flex/library` | Бібліотека 5B | `features/library` |

Спільні дані FLEX (типи, хуки, `mediaUrl`, `compareHref`) — у `features/flex-tests`.
`features/experiment-3d` — 3D-відтворення тесту з виміряних рядів (React Three Fiber) поруч із реальними кадрами камер; three.js вантажиться окремим чанком лише при відкритті вкладки ([ADR 0007](decisions/0007-3d-replay.md)). Юніт-тести чистих функцій — `*.test.ts` поруч із кодом, `node:test` (`npm test`), окремий `tsconfig.test.json`.
Імпорти через alias `@/`. Фічі не імпортують одна одну всередину — тільки через `index.ts`.

## Деплой
Railway: сервіси `backend` (root `backend/`, Volume `/data`) і `frontend` (root `frontend/`, nginx). Див. [deployment.md](deployment.md).
