# Деплой на Railway

Проєкт Railway **`flame-in-freefall`** (environment `production`), два сервіси з репо `MartyniukAleksei/nasa-2026`, гілка `main`.

| Сервіс | Root Directory | Build | PORT | Домен |
|---|---|---|---|---|
| `backend` | `/backend` | `Dockerfile`, healthcheck `/api/health`, watch `/backend/**` | 8000 | https://backend-production-9169dad7.up.railway.app |
| `frontend` | `/frontend` | `Dockerfile`, watch `/frontend/**` | 8080 | https://frontend-production-6436668c.up.railway.app |

Налаштування сервісів зберігаються в самому Railway (задані через CLI / GraphQL API). `railway.json` (Config as Code) Railway вже вважає застарілим — якщо захочемо конфіг у репо, мігруємо на Infrastructure as Code (`.railway/railway.ts`, `railway config`).

## CI/CD
- **CI** — GitHub Actions `.github/workflows/ci.yml` на кожен PR і push у `main`: `backend` (ruff check/format, pytest), `frontend` (`npm run build` = tsc + vite), `docker` (збірка обох образів).
- **Гілка `main` захищена**: мердж лише через PR із зеленими `backend`, `frontend`, `docker (backend)`, `docker (frontend)`; пряме пушення заборонене.
- **CD** — Railway слідкує за `main` і для кожного сервісу чекає на успішний CI (*Wait for CI*), лише потім деплоїть. Зміни лише в одній частині (watch patterns) не перезбирають іншу.

## backend
- **Volume** `backend-volume` змонтовано в `/data`. Вміст: `/data/flex/…` (знімок FLEX) і `/data/build/flame.duckdb`.
- Змінні: `PORT=8000`, `DATA_DIR=/data`, `DATA_ARCHIVE_URL=https://github.com/MartyniukAleksei/nasa-2026/releases/download/data-flex-v1/flex-v1.zip`, `ENV=production`, `CORS_ORIGINS=["https://frontend-production-6436668c.up.railway.app"]`; далі — ключі LLM, коли з'явиться агент.
- Healthcheck: `/api/health` (поля `db` і `flex_data` показують, чи Volume заповнений).

### Як заповнюється і оновлюється Volume (автоматично)
Контейнер стартує з `python -m flame.ingest.bootstrap && uvicorn …`. Bootstrap ідемпотентний:
1. **Знімок FLEX.** Якщо `/data/flex` немає або `DATA_ARCHIVE_URL` відрізняється від записаного в `/data/.archive_url` — качає zip (GitHub Release [`data-flex-v1`](https://github.com/MartyniukAleksei/nasa-2026/releases/tag/data-flex-v1)) і замінює `/data/flex`.
2. **БД.** Якщо `flame.duckdb` немає, знімок оновився або `build_db.BUILD_VERSION` (хеш коду збірки) не збігається з записаним у таблиці `meta` — перезбирає `build/flame.duckdb`.

Тобто:
- **змінили обробку даних** (`flame/ingest/build_db.py`, `flame/rag/*`) → PR → мердж → деплой сам перезбере БД;
- **новий знімок** → опублікувати реліз `data-flex-vN`, змінити `DATA_ARCHIVE_URL` у Railway → редеплой скачає й перезбере.

Перевірити, що на проді: `GET /api/health` → `db_build` (версія коду збірки) і `dataset` (версія знімка).
Перший старт довший (~265 МБ), тому `healthcheckTimeout` = 600 с.

## frontend
- Змінні: `PORT=8080`, `VITE_API_URL=https://backend-production-9169dad7.up.railway.app` (вшивається в бандл на етапі build; після зміни — redeploy).
- nginx віддає SPA з fallback на `index.html`.

## Локальна імітація
`docker compose up --build` — ті самі образи, `./data` → `/data` (read-only).
