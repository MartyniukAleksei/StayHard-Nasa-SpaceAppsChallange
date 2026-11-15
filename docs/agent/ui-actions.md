# UI-дії агента — контракт (етап 2, чернетка для перегляду)

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
| `open_video` | `test_no` | сторінка тесту, вкладка відео (лише 14 тестів з mp4) — етап 4 |
| `open_frame` | `test_no, camera, t_s` | переглядач кадрів на момент `t_s` — етап 4 |
| `open_replay` | `test_no, t_s` | 3D-replay на момент `t_s`, коли його перенесуть у `frontend/` — етап 4 |

Бекенд-інструмент `propose_action` перевіряє параметри (тести існують, ≤ 3 для compare) і відповідає моделі «shown to user». Кнопка під відповіддю: «Opened comparison of FLEX-019, 023» після кліку + «Back».

## Контекст сторінки (`page_context`)
Фронт додає до кожного питання: `{route, test_no?, ids?, filters?}` з URL. Агент використовує його лише щоб зрозуміти «цей тест», дані бере інструментами.

Питання до власника сторінок (Bohdan): назви полів для підсвічування (`data-field="p_atm"` на рядках параметрів?), чи є стабільний спосіб передати `t_s` у переглядач кадрів/replay через URL.
