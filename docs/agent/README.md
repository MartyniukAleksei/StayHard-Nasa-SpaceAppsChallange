# Агент

Агент відповідає на питання про FLEX лише з даних інструментів, кожне число — з посиланням ([ADR 0006](../decisions/0006-citation-contract.md)). Архітектура — [ADR 0007](../decisions/0007-agent-architecture.md). Код: `backend/src/flame/agent/`.

## Етапи
| Етап | Що | Стан |
|---|---|---|
| 1 | Бекенд: цикл, інструменти даних, цитати, ліміти, SSE, eval | ✅ |
| 2 | Чат у UI (бічна панель), пропозиції дій, підсвічування — [ui-actions.md](ui-actions.md) | після мерджу сторінок фронтенду |
| 3 | Графіки `make_chart` | план |
| 4 | Кадри камер за подією, відео, replay | план |
| — | Симуляція what-if | відкладено |

## Модель і налаштування
`claude-sonnet-5-5`, адаптивне мислення, `effort=medium` (`AGENT_EFFORT`), server-side fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) на випадок відмови класифікатора. Кеш промпта: system + tools + розмова. Змінні — у `.env.example` (`ANTHROPIC_API_KEY`, `AGENT_*`).

## Інструменти даних (`tools.py`)
| Інструмент | Сервіс | Джерела |
|---|---|---|
| `query_tests(filters, sort, descending, limit)` | `studies.flex.service.query_tests` | рядки таблиці + підсумок запиту (і для порожнього результату) |
| `get_test(test_no)` | `get_test` | рядок таблиці, коментар TestSheet |
| `compare_tests(test_nos)` | `compare_tests` | обчислене порівняння (`/compare?ids=`) + рядки |
| `find_similar_tests(test_no, k)` | `neighbors` | рейтинг схожості (оцінка) + рядки |
| `get_timeseries_summary(test_no, signal)` | `get_timeseries` | зведення ряду, сирий файл |
| `search_docs(query, test_nos, source_types)` | `rag.service.search` | чанки RAG |

Усі схеми `strict: true`. `tool_result` містить лише блоки `search_result` (API не дозволяє змішувати їх з текстом).

## API: `POST /api/agent` (SSE)
Запит: `{"messages": [{"role": "user"|"assistant", "text": "...", "sources": [{n, url, title}], "page_context": {...}}]}` — **стисла історія**, яку тримає фронт у `sessionStorage`: текст реплік і джерела, без блоків міркувань і результатів інструментів. Повне прибирання thinking-блоків дозволене правилами preserved thinking Sonnet 5.5, а клієнт не може підкинути «результати інструментів». Усередині однієї відповіді цикл лише дописує повідомлення.

Події:
| Подія | Дані | UI |
|---|---|---|
| `text_start` | — | почати новий буфер тексту кроку |
| `text_delta` | `text` | показати текст наживо |
| `status` | `tool`, `text` | рядок кроку («Searching the test table…») |
| `rewrite` | `reason` | відповідь переписується: очистити буфер |
| `limit` | `reason` (`max_steps`, `max_tokens`, `refusal`), `message` | пояснення користувачеві |
| `error` | `reason` (`model_busy`, `api_error`), `message` | пояснення користувачеві |
| `done` | `answer {segments[{text, cites[], general, uncited}], sources[{n, url, title, quotes[]}]}`, `usage`, `cost_usd`, `rewritten`, `duration_s` | фінальна відповідь з `[n]`, popover з `quotes`, позначки «General knowledge» / «No source» |

Відмови до стріму — JSON `{"detail": {"reason", "message", "retry_after"}}`: 503 `not_configured` / `budget`, 429 `rate_limit` (+ `Retry-After`), 422 `bad_history` / `too_long`. Фронт показує `message` як є.

## Цитати й «No source» (`citations.py`)
Відповідь ділиться на сегменти за блоками API. Рядок з виміряним значенням (десяткове число або число з одиницею, якого немає в самому питанні) без жодної цитати й поза абзацом `General knowledge:` → `uncited`. Заголовки груп (`**…**`) не перевіряються. Якщо такі є — один перезапит моделі з переліком; що лишилось — позначка «No source» в UI.

## Ліміти (`limits.py`, `config.py`)
5 запитів/хв і 50/добу з IP; 8 кроків на відповідь (останній — без інструментів, з поясненням); 8000 вихідних токенів на крок; 10 останніх реплік історії; питання ≤ 2000 символів; стеля витрат процесу `AGENT_BUDGET_USD` (жорсткий ліміт — в Anthropic Console).

## Eval (`eval.py`, `evalsets/agent_psi69.jsonl`)
```bash
uv run python -m flame.agent.eval --budget 1.0          # витрачає гроші, не в CI
uv run python -m flame.agent.eval --only trap-no-data
```
15 питань: фільтри, підрахунок, порівняння, «чому», пояснення, часовий ряд, документи, змішане, контекст сторінки, поза темою і пастки (Disruption, CO₂/He при O₂ ≥ 30%, `fiber_conflict`). Перевірки: цитати є; немає «No source»; кожне десяткове число процитованого сегмента є в його цитатах (або в питанні); очікувані тести/URL серед джерел; ключові фрази; поза темою — без джерел. Витрати пишуться в `$DATA_DIR/agent_spend.json`, прогін зупиняється на `--budget`.

### Результати (2026-11-15, локально)
- Вартість відповіді: $0.003–0.09, медіана ≈ $0.03; прогін 15 питань ≈ $0.45.
- Час: медіана 10–13 с, максимум 27 с (складні змішані питання й перезапит через «No source»).
- Останній прогін: 9/12 (3 питання — мережеві збої з боку розробника). Провали — справжні речення без цитати після перезапиту; їх UI позначить «No source».
- Відкриті питання: чи лишати перезапит (дає +5–8 с, допомагає не завжди); переранжування в RAG на Railway додає ~2–3 с на `search_docs` (див. memory/плани).
