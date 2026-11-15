# Агент

Агент відповідає на питання про FLEX і ще п'ять досліджень PSI (CFI, ACME CFI-G, BASS-II, SAME-R, Saffire-II — [data/psi-studies.md](../data/psi-studies.md)) лише з даних інструментів, кожне число — з посиланням ([ADR 0006](../decisions/0006-citation-contract.md)). Архітектура — [ADR 0007](../decisions/0007-agent-architecture.md). Код: `backend/src/flame/agent/`.

## Етапи
| Етап | Що | Стан |
|---|---|---|
| 1 | Бекенд: цикл, інструменти даних, цитати, ліміти, SSE, eval | ✅ |
| 2 | Чат у UI (бічна панель), пропозиції дій, підсвічування — [ui-actions.md](ui-actions.md) | ✅ |
| 3 | Графіки `make_chart` | ✅ |
| 4 | Кадри камер за подією, відео, replay | ✅ |
| 5 | Інші дослідження PSI: інструменти над схемами `cfi`, `cfig`, `bass2`, `samer`, `saffire2`, RAG по їхніх описах і публікаціях | ✅ |
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
| `search_docs(query, study, test_nos, source_types)` | `rag.service.search` | чанки RAG; `study` = slug або `any` (FLEX: документи й TestSheet; інші — лише опис і публікації з `about.json`) |
| `propose_action(action, label, test_nos, explorer)` | — (валідація тестів і фасетів) | подія `proposal`, моделі — текст |
| `highlight_params(fields, test_nos)` | — | подія `highlight`, моделі — текст |
| `make_chart(kind, quantity, test_nos, filters, x_field, y_field)` | `studies/flex/charts.py` | подія `chart` (дані для `TimeChart`), моделі — підсумок кожної серії як `search_result` |
| `find_frame(test_no, event, t_s, camera)` | `media.service` + `media/timing.py` | подія `frame`; джерело — URL кадру з часом від запалювання |
| `look_at_frames(test_no, camera, t_s[≤4])` | те саме + `frame_jpeg(…, 512)` | зображення для зору моделі (без `search_result`), події `frame` для UI |
| `describe_study(study)` | `studies.psi.service.overview` | DOI, профіль колонок `tests` (діапазони, категорії), часові ряди, примітки до даних (`studies/psi/notes.py`) |
| `query_study_tests(study, filters, columns, sort, descending, limit)` | `query_tests` | підсумок запиту + рядки (`/api/studies/{slug}/tests/{id}`); оп. `contains` для тексту |
| `aggregate_study_tests(study, filters, group_by, metric)` | `aggregate` | обчислені кількості й count/mean/min/max (`/api/studies/{slug}/aggregate`) |
| `get_study_test(study, test_id)` | `get_test` | рядок тесту + які ряди й файли є |
| `get_study_timeseries_summary(study, test_id, series)` | `timeseries` | кількість точок і діапазон кожної колонки (у samer — ряд прогону) |

Інструменти FLEX (`query_tests`, `make_chart`, кадри, кнопки) працюють лише з FLEX. Для інших досліджень сторінок, графіків і кнопок поки немає; поле `field` у фільтрах — назва колонки таблиці, яку перевіряє `studies/psi/repository.py` за `information_schema`.

`strict: true` — лише в інструментів з малими схемами (`tools.STRICT`): API компілює строгі схеми в граматику з обмеженням розміру, а переліки полів `query_tests` / `propose_action` / `highlight_params` / `make_chart` її переповнюють («compiled grammar is too large»); їхній ввід повністю перевіряє код. `tool_result` містить або лише блоки `search_result`, або лише текст/зображення (API не дозволяє змішувати).

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
| `proposal` | `{id, action, label, params}` | кнопка-пропозиція (див. ui-actions.md) |
| `highlight` | `{fields[], test_nos[]}` | підсвітити `[data-field]` на поточній сторінці |
| `chart` | `{kind, title, x_label, y_label, derived, series[{id,label,points,kind,tone}], test_nos, notes}` | графік у повідомленні (`ChartBlock`), `[Open on page]`, `[Download CSV]` |
| `frame` | `{test_no, camera, camera_label, index, t_s, event, url}` | кадр у повідомленні (`FrameStrip`), підпис з часом (`derived time`) |
| `done` | `answer {segments[{text, cites[], general, uncited}], sources[{n, url, title, quotes[]}]}`, `usage`, `cost_usd`, `rewritten`, `duration_s` | фінальна відповідь з `[n]`, картка джерела з `quotes`, позначки «General knowledge» / «No source» |

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

## Фронтенд (`frontend/src/features/agent`)
- `AgentProvider` (у `app/Layout.tsx`) — стан чату, стрім `POST /api/agent` (`api.ts`), історія в `sessionStorage` (`lib/history.ts`), `page_context` з URL (`lib/context.ts`).
- `AgentLauncher` — кнопка `>_ agent` у шапці (пошукового поля в шапці немає): відкриває й закриває термінал агента, те саме — `Ctrl+`` / `⌘+``; поки агент відповідає, на кнопці блимає мітка, коли панель закрита — лічильник питань.
- `AgentPanel` — **термінал** збоку (усе моноширинне; на ≥ 1100 px сторінка відсувається, на ≤ 600 px — на весь екран). Рядок заголовка — контекст («● agent · Test #35 · Watch») і кнопки `expand` / `clear` / `×`. На початку журналу — вітальний блок як у Claude Code: хто це й на що дивиться; поки розмова порожня — 3 підказки під сторінку. Репліки: `> питання` (під ним «on …»), `● відповідь`, `✻ крок…`. Знизу поле з `>`: Enter — надіслати, Shift+Enter — новий рядок, Esc — зупинити відповідь або закрити термінал. Решта:
  - **розмір**: лівий край тягнеться мишею або ← → (320 px … 70 % екрана, подвійний клік — 420 px), ширина в `localStorage` (`ag-width`) і CSS-змінній `--ag-w`; `[Expand]` / `[Collapse]` — на весь екран (розмова в колонці ≤ 860 px), `Esc` згортає;
  - **контекст**: під заголовком «Context: Test #35 · Watch» — сторінка й розділ (`h2`), який користувач бачить (`lib/useSection.ts`, `describeContext` у `lib/context.ts`); те саме йде в `page_context.section`; під кожним питанням — «asked on …»;
  - **цитати як у NotebookLM**: наведення/фокус на `[n]` — попап з дослівною цитатою; клік — картка джерела внизу панелі **і** перехід до місця на сайті (`lib/jump.ts` → `focusOnPage` у `lib/highlight.ts`): рядок таблиці → сторінка тесту, розділ Parameters, підсвічені поля з цитати; коментар TestSheet → «What happened» з підсвіченою фразою (CSS Custom Highlight API); часовий ряд → потрібний графік; порівняння → сторінка порівняння; PDF/файли/DOI — нова вкладка (PDF на сторінці `#page`);
  - подія `highlight` підсвічує й прокручує до першого значення;
  - позначка «no source» лишається; «general knowledge» у UI не показується;
  - кнопки-пропозиції з `[Back]`, повідомлення лімітів і помилок (`message` з бекенду).
- Чисті функції в `lib/` з тестами `node:test`: `sse`, `answer` (рендер сегментів і мінімального markdown), `history`, `links`, `actions`, `context`, `jump`; `highlight`, `useSection` — DOM.

## Графіки (`studies/flex/charts.py`, `make_chart`)
- **line** — одна величина в часі для 1–3 тестів на спільних осях: `droplet_diameter`, `droplet_d2` (derived), `droplet_d2_normalized` ((d/d₀)² від t/d₀², derived), `flame_diameter_uv`, `flame_diameter_color`, `standoff_uv`. Лише t ≥ 0 (після запалювання), ≤ 300 точок на серію. Тест без ряду чи без d₀ пропускається з приміткою.
- **scatter** — два числові поля таблиці для тестів за фільтрами (формат `query_tests`), групи за типом завершення (тони й значки `EndMark`).
- Фітів і екстраполяції немає; моделі повертаються підсумки серій як джерела. Фронт: `ChartBlock` (`TimeChart`), CSV з DOI в першому рядку (`lib/csv.ts`).

## Кадри, відео, replay (етап 4)
- **Час кадру від запалювання** (`media/timing.py`): нуль — рядок «AS Igniter Off/Retract Start» у лозі `<CIR>.txt` (як у 3D-replay), час кадру = `start_time` архіву + `t_ms` − нуль. Перевірено на FLEX-100: кінець ряду UV-полум'я 6.12 с ↔ кадр камери B при 6.08 с.
- **Події:** `ignition` (0 с), `extinction` (кінець ряду полум'я UV, інакше кольорового), `end` (кінець ряду краплі), `time` (довільний `t_s`). Кадри тягнуться з NASA PSI (~7 с на перший запит до архіву), UI показує статус.
- **Пропозиції** `open_video` (лише якщо в тесту є локальний mp4, інакше помилка моделі → чесне «немає відео») і `open_replay(t_s)` → `/studies/flex/tests/{n}?view=3d&t=…#tp-media`; `MediaBlock` відкриває вкладку й ставить 3D/2D replay на паузу в цей момент (`startAt`).

## Збирання відповіді
У Sonnet 5.5 текст між викликами інструментів приходить як службові блоки міркувань і користувачу не показується. Тому промпт вимагає спершу всі виклики (дані, графіки, кадри, кнопки), а повну відповідь — в останньому повідомленні. `loop._answer_content` збирає текстові блоки всіх повідомлень асистента за хід (після перезапиту «No source» — лише переписані).
