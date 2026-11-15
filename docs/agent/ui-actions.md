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
Фронт додає до кожного питання: `{route, test_no?, ids?, filters?}` з URL. Агент використовує його лише щоб зрозуміти «цей тест», дані бере інструментами.

## Розмітка сторінок для підсвічування
Сторінки позначають значення атрибутами, агент лише додає клас `ag-hl` (`features/agent/lib/highlight.ts`), імпортів між фічами немає:
- `data-field="p_atm"` — ключі полів API (`studies/flex/fields.py`), кілька через пробіл (`data-field="x_o2 x_n2 x_co2 x_he diluent"`); вибір — `[data-field~="…"]`;
- `data-test="19"` — контейнер значень одного тесту (сторінка тесту: `dl.tp-kv`; порівняння: `article.cmp-col`). Якщо `test_nos` у події порожній — підсвічуються всі збіги.

Зараз розмічено: параметри на сторінці тесту (`TestReport` → `Params`) і колонки порівняння (`Compare`). Нова сторінка з параметрами — додай ці атрибути, і підсвічування запрацює.

## Параметри `open_tests`
`explorer` — ті самі ключі й значення, що в `features/explorer/lib/filter.ts` (`fuel`, `diluent`, `pressure ∈ 0.7|1|2-3`, `o2 ∈ <16.5|16.5-21|air|21.6-30|30+`, `fiber ∈ free|fiber|unknown|all`, `end`, `tag ∈ series|video|3d|cool`). Тест бекенду звіряє переліки з `filter.ts`.

## Час у відео/replay (етап 4)
Сторінка тесту читає `?view=video|replay|3d&t=<секунди>` і відкриває потрібну вкладку на моменті `t`.
