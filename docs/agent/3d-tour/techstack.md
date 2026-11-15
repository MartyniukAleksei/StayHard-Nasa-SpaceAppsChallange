# 3D-тур агента — засоби

Нових залежностей не потрібно: усе є в `frontend/package.json` (`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`) і в бекенді агента. Якщо таки знадобиться нова npm-залежність, `package-lock.json` оновлюють у Linux (див. скіл `stayhard-frontend`).

## Принцип: агент — режисер, сцену програє фронтенд

```
питання → агент (Claude Sonnet 5.5, loop.py)
        → інструмент show_in_3d(test_no, steps[])          ← модель обирає лише з переліків
        → бекенд: перевіряє, обчислює моменти, підставляє числа, додає джерела
        → SSE-подія `tour` {id, test_no, steps[] з готовими підписами}
        → фронт (фіча agent): відкриває /studies/flex/tests/{n}?view=3d&tour={id}
        → experiment-3d: TourDirector програє кроки на Playback і в сцені
```

Модель **не генерує 3D, не пише координат і чисел**. Вона обирає момент, ракурс, об'єкт і дію з переліків і пише короткий текст підпису із заповнювачами.

## Бекенд (`backend/src/flame/agent`, `flame/studies/flex`, `flame/media`)

| Що | Де | Як |
|---|---|---|
| Інструмент `show_in_3d` | `agent/tools.py` | JSON-схема з `enum` для `moment`, `camera`, `focus`, `action`. Не в `STRICT` (граматика велика, див. помилку «compiled grammar is too large»), валідація — вручну. Повертає `ToolOutput(sources, events=[tour])`. |
| Модуль туру | новий `studies/flex/tour.py` | Чиста логіка: моменти → секунди, значення заповнювачів із рядів, перевірка тексту. Тест — `tests/test_tour.py`, фейкова БД як в інших тестах. |
| Події апаратури | `media/timing.py` | Перенести з `frontend/.../experiment-3d/lib/log.ts` розбір рядків логу (`needlesRetract`, `igniterOn`, `igniterRetracted`) поруч з `ignition_epoch_ms`. Мітки беруть ті самі, що у фронті. Тест звіряє обидві реалізації на одному лозі. |
| Значення в моменті | `studies/flex/repository.timeseries` + `service` | Найближчий відлік ряду (або лінійна інтерполяція між двома сусідніми) для `droplet.d_mm`, `flame_color.flame_d_mm`, `flame_uv.flame_d_mm`. Якщо відліку немає в межах ±0.25 с — «no measurement», і заповнювач не підставляється. |
| Джерела | `core/citations.py` | Лише цим модулем: `timeseries_url(STUDY, n, signal)` для чисел із рядів, `test_url` для табличних полів, `media_url` для коментаря NASA. Кожен підпис несе `source_index` у списку `sources` туру. |
| Промпт | `agent/prompt.py` | Коли робити тур (питання «що відбувається / покажи / чому згасло» про один тест), структура 3–6 кроків, текст ≤ 90 символів, жодних цифр у тексті — лише заповнювачі. Тур і текстова відповідь кажуть одне й те саме, текст — із цитатами. |
| Перевірка тексту підпису | `tour.py` | Відхиляти цифри поза заповнювачами (крім «FLEX-155» / «#155»), невідомі заповнювачі, > 2 підписів на крок, > 6 кроків. Помилку повертати моделі текстом, щоб вона виправила виклик (як `InvalidFilter`). |
| Ціна й ліміти | `agent/limits.py` | Нічого нового: тур — це один виклик інструмента. Ціль ≤ $0.06 на відповідь з туром. |

**Перелік моментів (`moment`):** `needles_retract`, `igniter_on`, `ignition` (t = 0, «AS Igniter Off/Retract Start»), `flame_max` (максимум діаметра полум'я, derived), `extinction` (останній відлік ряду полум'я, як у `find_frame`), `end_of_data`, `t` (+ `t_s`). Якщо моменту в тесті немає (немає логу чи ряду) — помилка моделі з поясненням.

**Заповнювачі:**
- у момент кроку: `{t}` (с), `{d}` (мм), `{d2}` (мм², derived), `{flame_d}` (колір), `{flame_d_uv}`;
- між кроками (derived): `{d_change}` (зміна d від попереднього кроку), `{dt}` (час від попереднього кроку);
- з таблиці тесту: `{d0}`, `{dext}`, `{K}`, `{burn_time}`.

Одиниці додає бекенд. Кожне підставлене значення отримує тег `data`, `derived` або `estimate`.

**Події апаратури** — цитувати джерелом лог тесту (`media_url` на `<CIR>.txt`).

## Фронтенд

### Фіча `agent` (`frontend/src/features/agent`)
- `types.ts`, `AgentProvider`: нова подія `tour`. На неї:
  1. зберегти спец туру в `sessionStorage` під ключем `flame.tour.<id>` (try/catch);
  2. якщо ми не на сторінці цього тесту з `view=3d` — `navigate('/studies/flex/tests/{n}?view=3d&tour={id}#tp-media')`;
  3. якщо вже там — `window.dispatchEvent(new CustomEvent('agent:tour', {detail: id}))`.

  Імпортів між фічами немає: контракт — URL, `sessionStorage` і подія `window`, як у `agent:highlight`.
- Підвантаження: на `tool_start` з `show_in_3d` — `import()` чанка зі сценою (three.js), щоб він був готовий до приходу `tour`. Статус: «Preparing 3D walkthrough…».
- На ≤ 600 px панель агента на час туру згортається в смугу внизу з кнопкою `[Chat]`, щоб сцену було видно.

### Фіча `experiment-3d`
| Що | Засіб |
|---|---|
| Час | Наявний `Playback` (`seek`, `toggle`, `setSpeed`). Додати плавну зміну швидкості (лінійне наближення `speed → target` за ~0.4 с) і `scrubTo(t, durationS)`: час іде до цілі з easing, сцена малює проміжні стани, і це виглядає як прискорена перемотка, а не стрибок. Назад — так само, коротким scrub, без миттєвого `seek`. |
| Камера | Залишити `OrbitControls` (камера вже стежить за краплею). Переліт — власний tween у `useFrame`: позиція й `target` за easing `easeInOutCubic` за 1.2–1.8 с. Під час туру `autoRotate = false`. Ракурси — функції від даних (`maxFlameDiameter`, позиція краплі): `overview`, `flame` (полум'я на ~2/3 кадру), `droplet` (крапля на ~1/3 кадру), `camera_view` (вид уздовж осі кольорової камери D, позначка `estimate`). |
| Підсвічування | `Selection` + `Select` + `Outline` з `@react-three/postprocessing` у наявному `EffectComposer` (контур кольору `--flame`, тонкий, без неону). Для невеликих об'єктів — додатково м'яке пульсування `emissiveIntensity` (вимикається за `prefers-reduced-motion`). |
| Підписи біля об'єкта | `Html` з `@react-three/drei`, прикріплений до групи краплі, полум'я чи апаратури: рухається з об'єктом, коли сцену крутять. Стиль StayHard: моно, рамка `var(--rule)`, фон `--deep`, без заокруглень і тіней, тонка лінія-виноска. Поява й зникнення — `opacity`, 250 мс. На ≤ 600 px біля об'єкта лише маркер-точка, а текст — у смузі під сценою (`occlude` не потрібен). |
| Якорі | Реєстр `anchors` у `Scene` (ref на `group` краплі, `FlameShell` колір/UV, `Trail`, голки й запалювачі в `Apparatus`). `focus` з туру → ref. |
| Режисер | `lib/tour.ts` (чиста функція, `node:test`): спец → таймлайн. Для кожного кроку: тривалість (з довжини тексту, 2.5–6 с, або `hold`), цільовий `t`, швидкість, ракурс, фокус, підписи. `components/TourDirector.tsx` виконує таймлайн у `useFrame` і на `Playback`. |
| Керування | Смуга туру над `Timeline`: `[Pause]`, `[Next]`, `[Replay]`, `[Exit tour]` (класи `.btn ghost`), «step 3/6», підпис поточного кроку (`role="status"`). Перетягування сцени користувачем не зупиняє тур, але наступний переліт камери стартує з поточної позиції. |
| Кадри камер | `FramesPanel` уже синхронний із `playback.t`. На паузі кроку виділити поточний кадр (рамка `--flame`) і показати під ним той самий підпис. Підвантажити кадри моментів туру заздалегідь (PSI віддає кадр за 1–2 с). |
| Без WebGL | `Fallback` → `DropletReplay` (`startAt`) + список кроків туру текстом. |

### Що вже готове і перевикористовується
- `?view=3d&t=` у `MediaBlock` і проп `startAt` в `Experiment3D` / `DropletReplay`.
- `usePlayback`, `presence`, `sample`, `dropletPosition`, `maxFlameDiameter`.
- `features/agent/lib/{sse,links,actions}.ts`, подія `frame`, `find_frame` у бекенді.
- `TimeChart`, `EndMark`, `.tag`, `.btn`, `Placeholder` (скіл `stayhard-frontend`).

## Плавність — технічні правила
- Жодної дискретної зміни стану між кроками: час — `scrubTo` або плавна зміна швидкості, камера — tween, підписи — fade. Нові кроки стартують, коли попередній переліт завершився.
- Тур стартує, лише коли три умови виконано: сцена змонтована (перший кадр намальовано), кадри першого кроку завантажені, відповідь агента завершена (`done`). До того — статус «Preparing 3D walkthrough…» у сцені.
- Обмежити DPR сцени під час переліту (`dpr={[1, 1.5]}`), якщо fps падає нижче 50 (`PerformanceMonitor` з drei).
- `prefers-reduced-motion`: без перельотів (зміна ракурсу через fade 200 мс), без пульсування, швидкість часу ≤ 1×.

## Перевірка
- Бекенд: `uv run ruff check . && uv run ruff format --check . && uv run pytest` (тести `tour.py` і `show_in_3d` з фейковим клієнтом).
- Фронт: `npm run build && npm test` (тести `lib/tour.ts`, розбір події `tour`, побудова URL).
- Браузер (preview `backend` + `frontend`): десктоп і 375 px, консоль чиста, fps (`performance.now` у `useFrame` або вкладка Performance).
- Eval агента: +3 кейси в `agent/evalsets/agent_psi69.jsonl` (тур для #155, відмова для тесту без рядів, жодних цифр у сирому тексті підписів). Прогін ≤ $1.
