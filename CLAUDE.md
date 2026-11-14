# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Flame in Freefall (NASA Space Apps 2026): an agentic web tool over NASA PSI microgravity-combustion data, focused on FLEX (PSI-69, 274 droplet-burning tests from the ISS). Monorepo: `frontend/` (React + Vite + TS) and `backend/` (FastAPI, Python package `flame`), each with its own Dockerfile and `railway.json`, deployed to Railway as two separate services.

Documentation for agents lives in `docs/`. Start at `docs/README.md`, which says what to read for each kind of task. Docs are in Ukrainian; code, identifiers and UI text are in English. When you change architecture, API contracts, the DB schema or commands, update the matching doc in the same change, and record significant decisions as an ADR in `docs/decisions/`. Where `docs/product/mission.md` disagrees with `docs/architecture.md`, `architecture.md` wins.

## Commands

Backend (run from `backend/`, Python 3.13 via uv):
```bash
uv sync
uv run uvicorn flame.main:app --reload          # :8000, Swagger at /docs
uv run pytest                                   # all tests
uv run pytest tests/test_health.py::test_health # single test
uv run ruff check . && uv run ruff format --check .
uv run python -m flame.ingest.psi_flex --verify # check data/flex against manifest.json
uv run python -m flame.ingest.build_db          # data/flex → data/build/flame.duckdb
```

Frontend (run from `frontend/`):
```bash
npm install
npm run dev     # :5173, proxies /api → :8000
npm run build   # tsc -b && vite build (this is also the type check)
```

Both production images together: `docker compose up --build` (backend :8000, frontend :8080; `./data` is mounted read-only as `/data`). `.claude/launch.json` defines the `backend` and `frontend` dev servers.

## Architecture

Data flow: PSI API → `flame.ingest.psi_flex` (offline) → `data/flex/` (snapshot, read-only source) → `flame.ingest.build_db` → `data/build/flame.duckdb` → FastAPI → React SPA.

- **The data is static and there is no server database.** The API opens a single DuckDB file `read_only` (`flame/db/duckdb.py`, dependency `get_cursor`). RAG chunks and their embeddings will go into the same file (a `chunks` table, searched with `array_cosine_similarity` or `vss`), and they are built offline, never at runtime. Chat history is not stored. Rationale: `docs/decisions/0001-*`.
- **`data/` is gitignored.** It holds `flex/` (~540 MB: CSV tables, time series, raw txt/pdf, mp4) and `build/`. In production it lives on a Railway Volume mounted at `/data` (`DATA_DIR`). Never edit `data/flex` by hand; derived data is produced only by `flame/ingest` scripts. Data schema and quirks: `docs/data/flex.md`.
- **All data paths come from `flame.core.config.settings`** (`data_dir`, `flex_dir`, `duckdb_path`; env vars via pydantic-settings, listed in `.env.example`). The local default is `<repo>/data`.
- **Backend modules** follow the layering `router → service → repository → db`, with SQL only in `repository.py` and parameterized. Domain packages are `studies/flex`, `media` (serves files from the Volume), `rag` and `agent`. The agent calls domain services and `rag`, never SQL directly. Every router is mounted under `/api` in `flame/api/router.py`. `flame.ingest` is offline-only and is never imported by the API. Most modules are still skeletons whose planned contents are described in their `__init__.py`.
- **Frontend layout:** `src/app` holds the router (react-router) and providers (TanStack Query, `staleTime: Infinity` because the data is static). Pages in `src/pages` stay thin. Feature modules in `src/features/<name>/` expose only `index.ts` to other modules. `src/shared` holds the `api/client.ts` fetch wrapper, which builds `${VITE_API_URL}/api…`. Use the `@/` alias. `VITE_API_URL` is baked in at build time; in dev, Vite proxies `/api` instead.
- **`backend/src/flame/ingest/psi_flex.py`** is the ported data-collection script (stdlib only, Ukrainian comments) and is excluded from ruff on purpose.

## Domain rules (from docs/product/mission.md, docs/data/flex.md)

- Numbers shown in the UI or in agent answers must come from the data. Anything we compute ourselves (for example K from a d² fit) is labelled as an estimate.
- Test `end_type` is Extinction, Completion or Disruption. Disruption means "self-extinction not observed", **never** "would burn forever".
- Tests with a fiber (`ts_fiber`) must not be mixed with free-floating droplets.
- The agent answers only from tool output and cites every claim (test, file, page or DOI). When data is missing, it says so.
- PSI data is CC0, but the FLEX DOI must be cited (`data/flex/about.json`).
