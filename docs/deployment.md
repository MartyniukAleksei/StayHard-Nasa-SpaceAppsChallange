# Деплой на Railway

Проєкт Railway **`flame-in-freefall`** (environment `production`), два сервіси з репо `MartyniukAleksei/nasa-2026`, гілка `main`.

| Сервіс | Root Directory | Build | PORT | Домен |
|---|---|---|---|---|
| `backend` | `/backend` | `Dockerfile`, healthcheck `/api/health`, watch `/backend/**` | 8000 | https://backend-production-9169dad7.up.railway.app |
| `frontend` | `/frontend` | `Dockerfile`, watch `/frontend/**` | 8080 | https://frontend-production-6436668c.up.railway.app |

Налаштування сервісів зберігаються в самому Railway (задані через CLI / GraphQL API). `railway.json` (Config as Code) Railway вже вважає застарілим — якщо захочемо конфіг у репо, мігруємо на Infrastructure as Code (`.railway/railway.ts`, `railway config`).

## CI/CD
- **CI** — GitHub Actions `.github/workflows/ci.yml` на кожен PR і push у `main`: `backend` (ruff check/format, pytest), `frontend` (`npm run build` = tsc + vite), `docker` (збірка обох образів).
- **Гілка `main`**: прямий push і мердж PR дозволені всім із write-доступом; заборонені лише force-push і видалення. Обов'язкових перевірок перед мерджем немає (з 2026-11-15, щоб команда не блокувалася), але деплой іде лише після зеленого CI на `main`.
- **CD** — job `deploy` у тому ж `ci.yml` (лише push у `main`, після зелених `backend`, `frontend`, `docker`) запускає `.github/scripts/railway_deploy.py`. Для кожного сервісу, чия тека змінилася від останнього успішного деплою, він або чекає, поки стартує власний автодеплой Railway цього коміту, або, якщо Railway його тримає, робить `railway redeploy --from-source` від імені project token і чекає `SUCCESS`. Деплої йдуть послідовно (`concurrency: deploy-production`); push у `main` не скасовує попередній запуск. Червоний `deploy` = деплой упав, логи: `railway logs --service <name>`. Чому так: [ADR 0007](decisions/0007-cd-from-github-actions.md).
- **Чому не лише автодеплой Railway.** Коміти від GitHub-акаунтів, не прив'язаних до учасників Railway-воркспейсу, Railway ставить у `WAITING` з `approvalReason: EXTERNAL_CONTRIBUTOR` і чекає ручного *Approve*; вимкнути це не можна, а запрошення учасників потребує плану Pro. Автодеплой (*Wait for CI*, watch patterns) лишається ввімкненим: коміти власника він деплоїть сам, job лише стежить за ним.
- **Секрет `RAILWAY_TOKEN`** (GitHub → Settings → Secrets → Actions) — Railway *project token* для environment `production` (Project Settings → Tokens). Створює власник інфраструктури; без нього job `deploy` падає з повідомленням.
- **Ручний деплой** (якщо треба): `railway redeploy --service <backend|frontend> --from-source --yes`.

## backend
- **Volume** `backend-volume` змонтовано в `/data`. Вміст: `/data/flex/…` (знімок FLEX), `/data/{cfi,cfig,bass2,samer,saffire2}/…` (інші дослідження, [data/psi-studies.md](data/psi-studies.md)), `/data/build/flame.duckdb` і `/data/.archives.json` (які архіви вже розпаковано).
- Змінні: `PORT=8000`, `DATA_DIR=/data`, `DATA_ARCHIVE_URL=https://github.com/MartyniukAleksei/nasa-2026/releases/download/data-flex-v1/flex-v1.zip` (або `DATA_ARCHIVE_URLS` — JSON-список архівів, див. нижче), `ENV=production`, `CORS_ORIGINS=["https://frontend-production-6436668c.up.railway.app"]`; далі — ключі LLM, коли з'явиться агент.
- Healthcheck: `/api/health` (поля `db` і `flex_data` показують, чи Volume заповнений).

### Як заповнюється і оновлюється Volume (автоматично)
Контейнер стартує з `python -m flame.ingest.bootstrap && uvicorn …`. Bootstrap ідемпотентний:
1. **Знімки.** Список архівів — `DATA_ARCHIVE_URL` + `DATA_ARCHIVE_URLS` (GitHub Releases [`data-flex-v1`](https://github.com/MartyniukAleksei/nasa-2026/releases/tag/data-flex-v1), `data-psi-studies-v1`). Кожен URL, якого ще немає в `/data/.archives.json`, качається по черзі: замінюються лише каталоги верхнього рівня з цього архіву (`flex/`, `cfi/`, …), zip видаляється одразу після розпакування. Старий маркер `/data/.archive_url` (лише FLEX) розпізнається, тож FLEX повторно не качається. Архів, прибраний зі списку, забувається, але його файли лишаються на Volume.
2. **БД.** Якщо `flame.duckdb` немає, знімок оновився або `build_db.BUILD_VERSION` (хеш коду збірки) не збігається з записаним у таблиці `meta` — перезбирає `build/flame.duckdb`. Разом із БД будується RAG-індекс: модель ембеддингів запечена в образ (`MODELS_DIR=/app/models`), тож мережа не потрібна; вектори перевикористовуються зі старої БД, тому повна векторизація (~хвилини CPU) буває лише на першій збірці або при зміні моделі.

> **Простій під час перезбирання.** Volume монтується лише в один контейнер, тож Railway зупиняє старий до старту нового, а uvicorn стартує лише після bootstrap. Поки БД перезбирається, бекенд віддає **502** (на деплої з RAG, 2026-11-15, — кілька хвилин). Якщо це стане проблемою: запускати uvicorn одразу, а перезбирання — у фоні з атомарною заміною файлу й перевідкриттям підключення (пропозиція, рішення за власником інфраструктури).

Тобто:
- **змінили обробку даних** (`flame/ingest/build_db.py`, `flame/rag/*`) → PR → мердж → деплой сам перезбере БД;
- **новий знімок** → опублікувати реліз (`data-flex-vN`, `data-psi-studies-vN`; кожен asset ≤ 2 ГіБ), замінити його URL у `DATA_ARCHIVE_URL(S)` у Railway → редеплой скачає лише цей архів і перезбере БД.

**Підключення `data-psi-studies-v1` (робить власник даних та інфраструктури):**
1. Реліз `data-psi-studies-v1` з asset-ом `psi-studies-v1.zip` (1.6 ГБ; усередині `cfi/ cfig/ bass2/ samer/ saffire2/ README.md`).
2. Місце на Volume: при першому старті одночасно лежать FLEX (0.54 ГБ), zip (1.6 ГБ), розпаковані знімки (1.98 ГБ) і БД (≈ 0.05 ГБ) — ≈ 4.3 ГБ піку, далі ≈ 2.6 ГБ.
3. `DATA_ARCHIVE_URLS=["…/data-flex-v1/flex-v1.zip","…/data-psi-studies-v1/psi-studies-v1.zip"]` (а `DATA_ARCHIVE_URL` прибрати або лишити тим самим FLEX-URL) → редеплой. У логах: `bootstrap: extracting bass2, cfi, cfig, saffire2, samer`, `studies: flex=flex-v1, cfi=cfi-v1, …`.

Перевірити, що на проді: `GET /api/health` → `db_build` (версія коду збірки) і `dataset` (версія знімка FLEX); версії інших знімків — у `meta.datasets` і таблиці `studies` БД.
Перший старт довший (~265 МБ), тому `healthcheckTimeout` = 600 с.

## frontend
- Змінні: `PORT=8080`, `VITE_API_URL=https://backend-production-9169dad7.up.railway.app` (вшивається в бандл на етапі build; після зміни — redeploy).
- nginx віддає SPA з fallback на `index.html`.

## Локальна імітація
`docker compose up --build` — ті самі образи, `./data` → `/data` (read-only).
