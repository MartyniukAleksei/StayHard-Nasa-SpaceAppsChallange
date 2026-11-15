# UI-дії агента — контракт (погоджено; етап 2 реалізовано)

Агент **не керує сайтом сам**: дії приходять у чат як **пропозиції** (кнопки) і виконуються лише кліком користувача. Виняток — **підсвічування** на поточній сторінці: воно нічого не змінює й спрацьовує одразу.

Маршрути й URL-стан — за гілкою `feat/home-overview`: `/studies/flex`, `/studies/flex/tests?…` (фільтри explorer у search params), `/studies/flex/tests/:id`, `/studies/flex/compare?ids=a,b,c` (≤ 3), `/studies/flex/library`.

## Нові SSE-події
| Подія | Дані | Що робить фронт |
|---|---|---|
| `proposal` | `{id, action, label, params}` | кнопка в повідомленні; клік виконує `action` |
| `highlight` | `{fields: [..], test_nos: [..]}` | підсвічує поля параметрів на поточній сторінці, якщо вони там є |

## Дії (`action`)
| action | params | Виконання |
|---|---|---|
| `open_tests` | `filters: [{field, op, value}]` | перехід у explorer з цими фільтрами |
| `open_test` | `test_no` | `/studies/flex/tests/:id` |
| `open_compare` | `test_nos` (2–3) | `/studies/flex/compare?ids=…` |
| `open_video` | `test_nos` (1) | `/studies/flex/tests/{n}?view=video#tp-media` (лише тести з локальним mp4) |
| `open_replay` | `test_nos` (1), `t_s` | `/studies/flex/tests/{n}?view=3d&t=<t_s>#tp-media` — 3D-replay на паузі в цей момент |

Кадри камер агент не відкриває окремою сторінкою: `find_frame` / `look_at_frames` показують їх прямо в чаті (подія `frame`).

Бекенд-інструмент `propose_action` перевіряє параметри (тести існують, ≤ 3 для compare) і відповідає моделі «shown to user». Кнопка під відповіддю: «Opened comparison of FLEX-019, 023» після кліку + «Back».

## Контекст сторінки (`page_context`)
Фронт додає до кожного питання: `{route, section?, test_no?, ids?, explorer?, study?, test_id?, test_ids?}` — з URL і `section` = заголовок `h2` розділу, який користувач бачить (напр. `"Watch"`, `"Droplet: the d² law"`). Той самий контекст панель показує під заголовком («Context: Test #35 · Watch»). Агент використовує його лише щоб зрозуміти «цей тест / цей графік», дані бере інструментами. `test_no`/`ids` — лише FLEX. На сторінках іншого дослідження (зараз `/studies/same-r/…`) приходять `study` (slug для інструментів, `samer`) і `test_id`/`test_ids` цього дослідження, а панель пише «Context: SAME-R test 73 · Watch»; промпт велить не читати їх як номери FLEX.

## Розмітка сторінок для підсвічування
Сторінки позначають значення атрибутами, агент лише додає клас `ag-hl` (`features/agent/lib/highlight.ts`), імпортів між фічами немає:
- `data-field="p_atm"` — ключі полів API (`studies/flex/fields.py`), кілька через пробіл (`data-field="x_o2 x_n2 x_co2 x_he diluent"`); вибір — `[data-field~="…"]`;
- `data-test="19"` — контейнер значень одного тесту (сторінка тесту: `dl.tp-kv`; порівняння: `article.cmp-col`). Якщо `test_nos` у події порожній — підсвічуються всі збіги.

- `data-source="comment"` — блок із дослівним коментарем дослідника («What happened» на сторінці тесту): у ньому шукається й підсвічується процитована фраза, коли користувач клікає `[n]` з джерелом «TestSheet — researcher comment».

Зараз розмічено: параметри на сторінці тесту (`TestReport` → `Params`), колонки порівняння (`Compare`), коментар (`WhatHappened`). Нова сторінка з параметрами — додай ці атрибути, і підсвічування й переходи з цитат запрацюють.

## Перехід із цитати (`lib/jump.ts`)
| Джерело (`url`) | Куди | Що показати |
|---|---|---|
| `/api/studies/flex/tests/N` | сторінка тесту | поля, названі в цитаті (`quoteFields`: pressure → `p_atm`, d0 → `d0_mm`, K → `k_mm2_s`…), інакше розділ Parameters |
| `…/raw/NNN/…` + назва «TestSheet — researcher comment» | сторінка тесту | фраза в `[data-source="comment"]` |
| `…/tests/N/timeseries/<signal>` | сторінка тесту | графік d² (`droplet`) або діаметрів полум'я |
| `…/tests/N/neighbors` | сторінка тесту | Similar tests |
| `/api/studies/flex/compare?ids=…` | порівняння | поля з цитати |
| PDF, інші файли, DOI | нова вкладка | — |

## Параметри `open_tests`
`explorer` — ті самі ключі й значення, що в `features/explorer/lib/filter.ts` (`fuel`, `diluent`, `pressure ∈ 0.7|1|2-3`, `o2 ∈ <16.5|16.5-21|air|21.6-30|30+`, `fiber ∈ free|fiber|unknown|all`, `end`, `tag ∈ series|video|3d|cool`). Тест бекенду звіряє переліки з `filter.ts`.

## Час у відео/replay (етап 4)
Сторінка тесту читає `?view=video|replay|3d&t=<секунди>` і відкриває потрібну вкладку на моменті `t`.
