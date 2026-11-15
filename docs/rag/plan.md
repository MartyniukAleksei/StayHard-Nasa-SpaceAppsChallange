# RAG: план імплементації

Гілка `feature/rag`, один PR. Статус на момент PR.

## 1. Видобування тексту — ✅
- [x] `rag/sources/__init__.py`: `Document`; `rag/sources/flex.py`: TestSheet (`tests.ts_comment` + префікс умов), PDF посторінково (`pypdf`, NFKC, прибирання крапок змісту), DOCX за заголовками, `about.json` (поля + публікації, DOI).
- [x] `uv run python -m flame.rag.sources.flex --dump out.jsonl` — вивантаження й статистика.
- [x] Висновки перегляду: текст PDF якісний; презентації й рисунки дають короткі сторінки (< 40 символів відкидаємо); `Summary.pdf` — лише осі й числа → не індексуємо; EIRD і Test Plan частково дублюються; таблиці тест-плану мають власні номери тестів (не `test_no`).

## 2. Контрольні питання — ⏳ заповнює власник продукту
- [x] Формат і 2 приклади: `backend/src/flame/rag/evalsets/psi69.jsonl` (`"example": true` пропускаються).
- [x] 28 питань з очікуваними джерелами (`psi69.jsonl`) + 10 відкладених (`psi69_holdout.jsonl`), написаних до тюнінгу й не використаних для нього. Очікувані джерела знайдено пошуком фраз у тексті чанків, а не видачею пошуку. Підтримується `filters` (як у `search_docs`).

## 3. Чанкінг, ембеддинги, таблиця `chunks` — ✅
- [x] `chunking.py`, `embed.py` (fastembed + bge-small), `index.py` (кеш ембеддингів, FTS).
- [x] Виклик у `ingest/build_db.py`; `meta`: `embed_model`, `embed_dim`, `n_chunks`.
- [x] `MODELS_DIR` у `core/config.py` і `.env.example`; модель і `fts` у Docker-образі.

## 4. Пошук, API, eval — ✅ (тюнинг після кроку 2)
- [x] `repository.py` (vector + BM25, фільтри), `service.py` (RRF), `router.py` → `GET /api/rag/search`.
- [x] `eval.py`: recall@k, MRR, список промахів.
- [x] Eval і тюнінг (recall@5 / MRR): гібрид 0.79 / 0.62 → глосарій абревіатур 0.86 / 0.69 → cross-encoder 0.93 / 0.88; відкладений набір 0.90 / 0.85. Промахи, що лишилися: питання про моделі кінетики (сторінка з таблицею моделей), SF6-матриця (дубль EIRD/Test Plan), №179 (схожі коментарі CO2-тестів).

## 6. Контракт джерел і API для агента — ✅
- [x] `core/citations.py`, ADR 0006; `url` у `chunks` і `Hit`, `Hit.to_source()`.
- [x] `media`: `GET /api/media/flex/files/{path}` (поруч із кадрами камер з PSI, ADR 0005).
- [x] `studies/flex`: `fields`, `tests` з фільтрами, картка тесту, часові ряди, `neighbors`, `compare`; `sources` у кожному результаті; `fiber_conflict`.
- [x] Прод після автодеплою перевірено: `/api/health` ok, `/api/rag/search` на проді дає ту саму видачу, що локально. Під час перезбирання БД бекенд ~кілька хвилин віддає 502 (див. deployment.md).

## 5. Тести й документація — ✅
- [x] `tests/test_rag_{chunking,sources,search}.py` з фейковим embedder (CI не качає модель).
- [x] `docs/rag/*`, ADR 0004, оновлено `architecture.md`, `data/flex.md`, `README.md`.

## Далі (поза цим PR)
- Агент: інструменти над `rag.service.search` і `studies.flex.service` (кожен повертає `sources` → `search_result`), промпт, перевірка цитат за ADR 0006, стрімінг `POST /api/agent`. Потрібен ключ Claude API у змінних Railway (рішення власника).
- Фронт: сторінка тесту за `/api/studies/flex/tests/{n}`, рендер цитат.
- Нове дослідження: `rag/sources/<study>.py` + `evalsets/<study>.jsonl` + підключення в `build_db`.
