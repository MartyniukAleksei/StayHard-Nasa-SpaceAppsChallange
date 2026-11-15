# Flame in Freefall

**NASA Space Apps Challenge 2026 · "Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data"**

An agentic web tool over NASA Physical Sciences Informatics (PSI) microgravity-combustion data. Ask a question in plain language. The agent finds real flight tests, puts them side by side, replays them from the recorded data, and explains what the differences mean for crew fire safety, from the ISS to a lunar base.

**Live:** https://frontend-production-6436668c.up.railway.app

## Why

Lunar habitats and rovers will run at **≥30% O₂ and ~0.7 atm**, an atmosphere that is much more flammable than Earth's air. NASA already flew experiments in these conditions, but the results are spread across PSI tables, hundreds of thousands of raw files and PDF reports. For example, FLEX has 17 droplet tests at ~0.7 atm and 30–34% O₂, and **none of them self-extinguished**. That finding sits in rows of a table that few people will ever open.

## What it does

- **Ask the agent.** It answers only from tool output over the real data and cites every claim with the test, file, page or DOI. When the data is missing, it says so.
- **Browse studies.** Each study has an overview with key findings and charts, a filterable test list, and per-test pages with time series, camera frames and video.
- **Compare tests** side by side.
- **Replay experiments in 3D** from the flight data.
- **Library.** The papers and reports behind each study, searchable through RAG.

| Study | PSI ID | What burns |
|---|---|---|
| FLEX: Flame Extinguishment Experiment | PSI-69 | 274 free-floating and fiber-supported fuel droplets on the ISS, with CO₂ / He diluents |
| SAME-R: Smoke Aerosol Measurement Experiment | PSI-101 | Smoke detection on the ISS, 2010 (66 runs with sensor time series) |
| Saffire-II | PSI-99 | A large fire inside an uncrewed Cygnus module, 2016 (9 material samples) |
| BASS-II: Burning and Suppression of Solids | PSI-25 | Burning of solid materials on the ISS, 2014–2018 (129 tests) |

The agent can also query CFI (PSI-39) and ACME CFI-G (PSI-159).

## How it works

```
PSI API → offline ingest → data snapshots → build_db → flame.duckdb (read-only) → FastAPI + Claude agent → React SPA
```

- **Frontend:** React, Vite, TypeScript, TanStack Query, React Three Fiber (`frontend/`)
- **Backend:** FastAPI, DuckDB, hybrid RAG (bge-small embeddings + BM25 + cross-encoder rerank), Claude agent streamed over SSE (`backend/`)
- **Data is static.** The database is rebuilt offline from versioned snapshots and never written at runtime.
- **Deploy:** two Docker services on Railway, deployed automatically from `main`.

## Run locally

```bash
# backend (Python 3.13, uv)
cd backend && uv sync && uv run uvicorn flame.main:app --reload   # :8000, Swagger at /docs

# frontend
cd frontend && npm install && npm run dev                          # :5173
```

Or run both production images with `docker compose up --build`. The data download, DB build and API keys are covered in [docs/development.md](docs/development.md).

## Documentation

Developer docs (in Ukrainian) start at [docs/README.md](docs/README.md): architecture, data schemas, agent, RAG, deployment, and design decisions (ADRs).

## Data and credits

- Data: NASA Physical Sciences Informatics, CC0-1.0. Please cite the study DOI; the FLEX DOI is in `data/flex/about.json`.
- Font: IBM VGA 8×16 from the Oldschool PC Font Pack, © VileR, CC BY-SA 4.0.
