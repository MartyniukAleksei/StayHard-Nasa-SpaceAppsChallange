# Flame in Freefall — NASA Space Apps 2026

Агентний веб-інструмент для даних NASA PSI про горіння в мікрогравітації (фокус: FLEX, PSI-69): знаходить тести за запитом природною мовою, порівнює їх, програє з польотних даних і пояснює висновки для пожежної безпеки.

| | |
|---|---|
| `frontend/` | React + Vite + TypeScript |
| `backend/` | FastAPI (пакет `flame`), DuckDB, RAG-агент |
| `docs/` | документація — почни з [docs/README.md](docs/README.md) |

Швидкий старт — [docs/development.md](docs/development.md). Деплой (Railway) — [docs/deployment.md](docs/deployment.md).

Дані: NASA PSI, CC0-1.0 — цитуйте DOI FLEX (`data/flex/about.json`).
