# 0003 — Монорепо: frontend/ + backend/ (src-layout)

**Статус:** прийнято, 2026-11-15

## Рішення
- `backend/` — Python-пакет `flame` у src-layout (`backend/src/flame`), менеджер uv, модулі за доменами (`studies/flex`, `rag`, `agent`, `media`, `ingest`) з шарами schemas → repository → service → router.
- `frontend/` — React + Vite + TS, feature-модулі (`src/features/*`), спільне в `src/shared`.
- Кожна частина має свій `Dockerfile` і `railway.json`; на Railway — окремі сервіси з Root Directory.
- Офлайн-пайплайн даних живе в тому ж пакеті (`flame.ingest`), щоб ділити конфіг і схему БД з API.

## Наслідки
Фронт і бек деплояться незалежно; контракт між ними — HTTP `/api` (типи на фронті дзеркалять Pydantic-схеми).
Код прототипу v1 і розвідувальні файли перенесено в архів поза репо (`~/Developer/nasa-2026-archive`).
