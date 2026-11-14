# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Flame in Freefall (NASA Space Apps 2026): an agentic web tool over NASA PSI microgravity-combustion data, focused on FLEX (PSI-69, 274 droplet-burning tests from the ISS). Monorepo: `frontend/` (React + Vite + TS) and `backend/` (FastAPI, Python package `flame`), each with its own Dockerfile, deployed to Railway as two separate services.

Documentation for agents lives in `docs/`. Start at `docs/README.md`, which says what to read for each kind of task. Docs are in Ukrainian; code, identifiers and UI text are in English. When you change architecture, API contracts, the DB schema or commands, update the matching doc in the same change, and record significant decisions as an ADR in `docs/decisions/`. Where `docs/product/mission.md` disagrees with `docs/architecture.md`, `architecture.md` wins.

## Guardrails for agents

Several people and their agents work in this repo in parallel. Team process: `docs/workflow.md`.
- Work on a feature branch and open a PR into `main`. `main` is protected (required CI checks, no direct or force push); do not try to bypass it.
- Do not touch infrastructure: no Railway changes (variables, volumes, services, deploys) and no creating, editing or deleting GitHub Releases. CD is automatic from `main`. Infra changes are the repo owner's call; propose them in the PR or the docs instead.
- Never hand-edit `data/flex` or `flame.duckdb`, and never write to the DB from the API. Every data change is code in `build_db` (see Architecture), and every new raw snapshot is a new release made by the data owner.
- Stay inside the module your task belongs to. Change shared code (`core/config.py`, `api/router.py`, `frontend/src/shared`, DB schema in `build_db`) in a separate small PR.
- Secrets live only in Railway variables and a local `.env`. Add new variable names to `.env.example` without values.
- Before a PR, run the same checks CI runs: backend `ruff check`, `ruff format --check` and `pytest`; frontend `npm run build`.

## Commands

Backend (run from `backend/`, Python 3.13 via uv):
```bash
uv sync
uv run uvicorn flame.main:app --reload          # :8000, Swagger at /docs
uv run pytest                                   # all tests
uv run pytest tests/test_health.py::test_health # single test
uv run ruff check . && uv run ruff format --check .
uv run python -m flame.ingest.psi_flex --verify # check data/flex against manifest.json
uv run python -m flame.ingest.build_db          # data/flex → data/build/flame.duckdb (force rebuild)
uv run python -m flame.ingest.bootstrap         # rebuild only if build version changed
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
- **The DB is never edited, only rebuilt.** Data processing lives in `flame/ingest/build_db.py` (plus modules listed in its `BUILD_SOURCES`, currently `flame/rag/`). `BUILD_VERSION` is a hash of that code, stored in the DB's `meta` table. `flame.ingest.bootstrap` runs before uvicorn in the container and rebuilds the DB when the version or `DATA_ARCHIVE_URL` changes, so merged processing changes reach production automatically. If you add a module that affects DB contents, add it to `BUILD_SOURCES`. The raw snapshot changes only through a new `data-flex-vN` GitHub Release.
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
