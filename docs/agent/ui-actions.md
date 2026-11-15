# UI-дії агента — контракт (погоджено; етап 2 реалізовано)

Агент **не керує сайтом сам**: дії приходять у чат як **пропозиції** (кнопки) і виконуються лише кліком користувача. Винятків два: **підсвічування** на поточній сторінці (нічого не змінює, спрацьовує одразу) і **3D-тур** — він сам відкриває 3D-replay тесту, коли відповідь завершена ([ADR 0010](../decisions/0010-agent-3d-tour.md), розділ «3D-тур» нижче).

Маршрути й URL-стан — за гілкою `feat/home-overview`: `/studies/flex`, `/studies/flex/tests?…` (фільтри explorer у search params), `/studies/flex/tests/:id`, `/studies/flex/compare?ids=a,b,c` (≤ 3), `/studies/flex/library`.

## Нові SSE-події
| Подія | Дані | Що робить фронт |
|---|---|---|
| `proposal` | `{id, action, label, params}` | кнопка в повідомленні; клік виконує `action` |
| `highlight` | `{fields: [..], test_nos: [..]}` | підсвічує поля параметрів на поточній сторінці, якщо вони там є |
| `tour` | `{id, test_no, steps[], sources[]}` | після `done` відкриває 3D-replay тесту й програє кроки (див. «3D-тур») |

## Дії (`action`)
| action | params | Виконання |
|---|---|---|
| `open_tests` | `filters: [{field, op, value}]` | перехід у explorer з цими фільтрами |
| `open_test` | `test_no` | `/studies/flex/tests/:id` |
| `open_compare` | `test_nos` (2–3) | `/studies/flex/compare?ids=…` |
| `open_video` | `test_nos` (1) | `/studies/flex/tests/{n}?view=video#tp-media` (лише тести з локальним mp4) |
| `open_replay` | `test_nos` (1), `t_s` | `/studies/flex/tests/{n}?view=3d&t=<t_s>#tp-media` — 3D-replay на паузі в цей момент |

З `params.study = "samer"` кнопки ведуть на сторінки SAME-R: `open_test` → `/studies/same-r/tests/{n}`, `open_compare` → `/studies/same-r/compare?ids=…`, `open_tests` → `/studies/same-r/tests`; `test_nos` — номери прогонів SAME-R. Решта дій для SAME-R недоступна.

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

## 3D-тур (`show_in_3d`, подія `tour`)
Інструмент `show_in_3d(test_no, steps[])` (`agent/tools.py` → `studies/flex/tour.py`) перевіряє кроки, обчислює моменти, підставляє числа й віддає подію:

```json
{"id": "toolu_…-0", "test_no": 155,
 "steps": [{"moment": "extinction", "t": 3.283, "action": "pause", "speed": 1.0,
            "camera": "droplet", "focus": ["droplet"], "show_frame": true,
            "labels": [{"at": "droplet", "text": "Visible flame out at 3.3 s; droplet still 2.52 mm",
                        "tags": ["derived", "data"], "source": 0}]}],
 "sources": [{"url": "/api/studies/flex/tests/155/timeseries/droplet", "title": "…"}]}
```

| Поле кроку | Значення |
|---|---|
| `moment` | `needles_retract`, `igniter_on`, `ignition` (t = 0), `flame_max`, `extinction` (останній відлік рядів полум'я), `end_of_data` (кінець ряду краплі), `t` (+ `t_s` на вході) |
| `t` | секунди від запалювання — обчислює бекенд |
| `action`, `speed` | `pause` — сцена стоїть на моменті; `play` — час іде від моменту зі швидкістю `speed` (0.25–4) |
| `camera` | `overview`, `flame`, `droplet`, `camera_view` (уздовж осі кольорової камери, оцінка) |
| `focus`, `labels[].at` | `droplet`, `flame_color`, `flame_uv`, `trail`, `needles`, `igniters`, `frame` |
| `show_frame` | виділити справжній кадр камери за цю секунду |
| `labels[]` | ≤ 2; `text` — уже з підставленими числами й одиницями; `tags` — `data` / `derived` для підставлених значень; `source` — індекс у `sources` або `null`, якщо в тексті немає значень |

Заповнювачі в тексті моделі: `{t}`, `{d}`, `{d2}` (derived), `{flame_d}`, `{flame_d_uv}`; `{d_change}`, `{dt}` (від попереднього кроку, derived); `{d0}`, `{dext}`, `{K}`, `{burn_time}` (таблиця тесту). Значення ряду — найближчий відлік у межах ±0.25 с. Власні цифри в тексті заборонені: помилка повертається моделі. Моделі інструмент віддає ті самі значення як `search_result`, щоб відповідь їх цитувала.

Фронт (без імпортів між фічами):
1. `features/agent` на подію `tour` зберігає спец у `sessionStorage` під ключем `flame.tour.<id>`;
2. після `done` — `navigate('/studies/flex/tests/{n}?view=3d&tour={id}#tp-media')`, а якщо ця сторінка вже відкрита з `view=3d` — `window.dispatchEvent(new CustomEvent('agent:tour', {detail: id}))`;
3. `features/experiment-3d` читає `?tour=` / слухає `agent:tour`, бере спец зі сховища й програє кроки; керування — `[Pause]`, `[Next]`, `[Replay]`, `[Exit tour]`.

## Час у відео/replay (етап 4)
Сторінка тесту читає `?view=video|replay|3d&t=<секунди>` і відкриває потрібну вкладку на моменті `t`.
