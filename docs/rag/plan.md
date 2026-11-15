# RAG: план імплементації

Гілка `feature/rag`, один PR. Статус на момент PR.

## 1. Видобування тексту — ✅
- [x] `rag/sources/__init__.py`: `Document`; `rag/sources/flex.py`: TestSheet (`tests.ts_comment` + префікс умов), PDF посторінково (`pypdf`, NFKC, прибирання крапок змісту), DOCX за заголовками, `about.json` (поля + публікації, DOI).
- [x] `uv run python -m flame.rag.sources.flex --dump out.jsonl` — вивантаження й статистика.
- [x] Висновки перегляду: текст PDF якісний; презентації й рисунки дають короткі сторінки (< 40 символів відкидаємо); `Summary.pdf` — лише осі й числа → не індексуємо; EIRD і Test Plan частково дублюються; таблиці тест-плану мають власні номери тестів (не `test_no`).

## 2. Контрольні питання — ⏳ заповнює власник продукту
- [x] Формат і 2 приклади: `backend/src/flame/rag/evalsets/psi69.jsonl` (`"example": true` пропускаються).
- [ ] 20–30 питань з очікуваними джерелами: `{"q": "...", "expected": [{"test_no": 2}] | [{"source_path": "...", "page": 5}], "note": "..."}`.

## 3. Чанкінг, ембеддинги, таблиця `chunks` — ✅
- [x] `chunking.py`, `embed.py` (fastembed + bge-small), `index.py` (кеш ембеддингів, FTS).
- [x] Виклик у `ingest/build_db.py`; `meta`: `embed_model`, `embed_dim`, `n_chunks`.
- [x] `MODELS_DIR` у `core/config.py` і `.env.example`; модель і `fts` у Docker-образі.

## 4. Пошук, API, eval — ✅ (тюнинг після кроку 2)
- [x] `repository.py` (vector + BM25, фільтри), `service.py` (RRF), `router.py` → `GET /api/rag/search`.
- [x] `eval.py`: recall@k, MRR, список промахів.
- [ ] Прогнати eval на заповненому наборі, підібрати `MAX_WORDS`/`OVERLAP_WORDS`/`CANDIDATES`, ціль recall@5 ≥ 0.8.

## 5. Тести й документація — ✅
- [x] `tests/test_rag_{chunking,sources,search}.py` з фейковим embedder (CI не качає модель).
- [x] `docs/rag/*`, ADR 0004, оновлено `architecture.md`, `data/flex.md`, `README.md`.

## Далі (поза цим PR)
- `studies/flex`: `query_tests` з whitelist полів (паралельна задача).
- Агент: `search_docs` як tool над `rag.service.search`, промпт цитування, стрімінг.
- Нове дослідження: `rag/sources/<study>.py` + `evalsets/<study>.jsonl` + підключення в `build_db`.
