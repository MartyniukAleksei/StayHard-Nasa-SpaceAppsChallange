# Деплой на Railway

Один Railway-проєкт, два сервіси з одного GitHub-репо (монорепо).

| Сервіс | Root Directory | Конфіг | Порт |
|---|---|---|---|
| `backend` | `backend` | `backend/railway.json` + `Dockerfile` | `$PORT` (uvicorn) |
| `frontend` | `frontend` | `frontend/railway.json` + `Dockerfile` | `$PORT` (nginx, дефолт 8080) |

## backend
- **Volume** змонтувати в `/data`. Вміст: `/data/flex/…` (знімок FLEX) і `/data/build/flame.duckdb`.
- Змінні: `DATA_DIR=/data` (вже в образі), `ENV=production`, `CORS_ORIGINS=["https://<frontend-domain>"]`, далі — ключі LLM, коли з'явиться агент.
- Healthcheck: `/api/health` (поля `db` і `flex_data` показують, чи Volume заповнений).

### Як заповнити Volume (один раз; дані статичні)
Варіант за замовчуванням — завантажити знімок із GitHub Release всередині контейнера:
```bash
railway ssh --service backend
# в образі немає curl/unzip — використовуємо Python
python -c "import urllib.request as u, zipfile; u.urlretrieve('<URL asset flex-vN.zip з GitHub Release>', '/data/flex.zip'); zipfile.ZipFile('/data/flex.zip').extractall('/data')" && rm /data/flex.zip
python -m flame.ingest.psi_flex --verify && python -m flame.ingest.build_db
```
Після оновлення знімка (`flex-v2`) — повторити. Код при цьому не передеплоюється.

## frontend
- Змінна збірки `VITE_API_URL=https://<backend-domain>` (вшивається в бандл на етапі build; після зміни — redeploy).
- nginx віддає SPA з fallback на `index.html`.

## Локальна імітація
`docker compose up --build` — ті самі образи, `./data` → `/data` (read-only).
