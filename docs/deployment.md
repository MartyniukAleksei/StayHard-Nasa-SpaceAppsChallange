# Деплой на Railway

Проєкт Railway **`flame-in-freefall`** (environment `production`), два сервіси з репо `MartyniukAleksei/nasa-2026`, гілка `main`.

| Сервіс | Root Directory | Build | PORT | Домен |
|---|---|---|---|---|
| `backend` | `/backend` | `Dockerfile`, healthcheck `/api/health`, watch `/backend/**` | 8000 | https://backend-production-9169dad7.up.railway.app |
| `frontend` | `/frontend` | `Dockerfile`, watch `/frontend/**` | 8080 | https://frontend-production-6436668c.up.railway.app |

Налаштування сервісів зберігаються в самому Railway (задані через CLI / GraphQL API). `railway.json` (Config as Code) Railway вже вважає застарілим — якщо захочемо конфіг у репо, мігруємо на Infrastructure as Code (`.railway/railway.ts`, `railway config`).

## backend
- **Volume** `backend-volume` змонтовано в `/data`. Вміст: `/data/flex/…` (знімок FLEX) і `/data/build/flame.duckdb`.
- Змінні: `PORT=8000`, `DATA_DIR=/data`, `DATA_ARCHIVE_URL=https://github.com/MartyniukAleksei/nasa-2026/releases/download/data-flex-v1/flex-v1.zip`, `ENV=production`, `CORS_ORIGINS=["https://frontend-production-6436668c.up.railway.app"]`; далі — ключі LLM, коли з'явиться агент.
- Healthcheck: `/api/health` (поля `db` і `flex_data` показують, чи Volume заповнений).

### Як заповнюється Volume (автоматично)
Контейнер стартує з `python -m flame.ingest.bootstrap && uvicorn …`. Якщо на Volume немає `flex/manifest.json`, bootstrap качає `DATA_ARCHIVE_URL` (GitHub Release [`data-flex-v1`](https://github.com/MartyniukAleksei/nasa-2026/releases/tag/data-flex-v1)), розпаковує в `/data` і збирає `build/flame.duckdb`. На заповненому Volume нічого не робить. Перший старт довший (~265 МБ), тому `healthcheckTimeout` = 600 с.

Оновити дані (`flex-v2`): опублікувати новий реліз, змінити `DATA_ARCHIVE_URL`, очистити Volume (видалити `/data/flex` і `/data/build`) і перезапустити сервіс.

## frontend
- Змінні: `PORT=8080`, `VITE_API_URL=https://backend-production-9169dad7.up.railway.app` (вшивається в бандл на етапі build; після зміни — redeploy).
- nginx віддає SPA з fallback на `index.html`.

## Локальна імітація
`docker compose up --build` — ті самі образи, `./data` → `/data` (read-only).
