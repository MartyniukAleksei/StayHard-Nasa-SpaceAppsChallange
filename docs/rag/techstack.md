# RAG: технічні рішення

## Конвеєр
```
офлайн (flame.ingest.build_db → flame.rag.index)
  rag/sources/flex.py ─► Document ─► rag/chunking.py ─► Chunk ─► rag/embed.py ─► таблиця chunks + FTS
рантайм (API, read-only)
  запит ─► embed_query ─┬─► vector_search (array_cosine_similarity) ─┐
                        └─► bm25_search  (fts match_bm25)        ───┴─► RRF ─► top-k Hit
```

## Корпус FLEX (PSI-69)
| Джерело | `source_type` | Документів | Чанків |
|---|---|---|---|
| `tests.ts_comment` (TestSheet), з префіксом умов тесту | `testsheet` | 266 | 266 |
| `docs/**/*.pdf` посторінково (8 файлів) | `doc_pdf` | 225 сторінок | 327 |
| `docs/**/*.docx` за розділами | `doc_docx` | 1 | 1 |
| `about.json`: objective, hypothesis, approach, researchImpacts | `about` | 4 | 5 |
| `about.json`: публікації (назва + автори) | `publication` | 51 | 51 |

Не індексуємо: `FLEX-NNN_Summary.pdf` (лише підписи осей і числа, дублюють таблиці), `Experimental table` (вже в `tests`), архів метаданих.

## Рішення
- **Чанкінг.** Короткі документи — один чанк. Сторінка PDF / розділ DOCX — абзацами до ~300 слів (≈400 токенів) з overlap 40 слів. Текст для ембеддингу й BM25 має заголовок `[PSI-69 FLEX] <title>`. `chunk_id` детермінований: `study:source_type:path:test_no|page[:section]:i`.
- **Ембеддинги — локально:** `fastembed` (ONNX, без torch) + `BAAI/bge-small-en-v1.5`, 384 виміри, ~130 МБ. Без ключів і мережі після першого завантаження; однакові в CI, локально і на Railway. Корпус англійською, агент формулює запит до `search_docs` англійською. Запити отримують bge-префікс (`embed.QUERY_PREFIX`). Рішення — [ADR 0004](../decisions/0004-rag-local-embeddings.md).
- **Векторний пошук — повний перебір** `array_cosine_similarity` у DuckDB, без HNSW/`vss`: для десятків тисяч чанків це десятки мс. Поріг перегляду — ~500 тис. чанків.
- **BM25** — розширення DuckDB `fts` (індекс будується в `build_db`). Ловить точні терміни: `LLUV`, `Dext`, `20CAL10`.
- **Злиття — Reciprocal Rank Fusion**: `score = Σ 1/(60 + rank)` по обох списках (по 30 кандидатів). Ранги з кожного пошуку повертаються для дебагу.
- **Кеш ембеддингів.** `index.build` бере вектори зі старого `flame.duckdb` за `text_hash = sha256(model + embed_text)`; рахує лише нові/змінені. Зміна моделі інвалідує кеш (`meta.embed_model`).
- **Не text-to-SQL і не MCP** — див. [mission.md](mission.md).

## Схема
```sql
chunks(chunk_id VARCHAR PRIMARY KEY, study VARCHAR, source_type VARCHAR, source_path VARCHAR,
       test_no INTEGER, page INTEGER, title VARCHAR, text VARCHAR, search_text VARCHAR,
       citation VARCHAR, text_hash VARCHAR, embedding FLOAT[384])
-- + FTS-індекс fts_main_chunks (по search_text); meta: embed_model, embed_dim, n_chunks
```

## API
`GET /api/rag/search?q=&k=8&study=&test_no=&test_no=&source_type=` → `list[Hit]`
(`chunk_id, study, source_type, source_path, test_no, page, title, text, citation, score, vector_rank, bm25_rank`). Для дебагу й UI; агент кличе `rag.service.search` напряму. 503, якщо індекс не зібрано.

## Розгортання
- Модель і `fts` запікаються в Docker-образ (`MODELS_DIR=/app/models`), тож bootstrap і рантайм не ходять у мережу. Локально модель кешується в `<DATA_DIR>/models` при першому запуску.
- Модель вантажиться ліниво при першому запиті (~0.3 с на Mac); повний гібридний пошук ~15 мс; процес API з моделлю ~380 МБ RSS.

## Продуктивність і масштаб (виміряно на FLEX)
- Повна збірка 650 чанків: ~40 с CPU (Mac); повторна з кешем: ~3 с.
- 10 досліджень ≈ 20–30 тис. чанків: перша повна векторизація ~20–30 хв на CPU, далі лише дельта завдяки кешу. Вектори ≈ 46 МБ у БД.
- Ризики: плутанина між дослідженнями (рішення — фільтр `study`); дубльовані сторінки (EIRD і Test Plan частково збігаються); у таблицях тест-плану «Test No.» — номери плану, а не `test_no` FLEX.
