# Перевірка перед «готово» / PR

## 1. Автоматичні перевірки (з `frontend/`)

```bash
npm run build   # tsc -b + vite build — це і є перевірка типів
npm test        # node:test для src/**/*.test.ts
```

Обидві мають бути зелені — CI (`.github/workflows/ci.yml`) запускає те саме, і без зеленого CI
мердж у `main` заблоковано.

**Юніт-тести** пишемо на чисті функції з `lib/` (фільтри, форматування, геометрія кадру):

```ts
// features/<name>/lib/thing.test.ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { TestSummary } from "@/features/flex-tests"; // з "@/" — лише `import type`
import { myFn } from "./thing.ts";                         // свій модуль — з розширенням .ts

describe("myFn", () => {
  test("does the thing", () => assert.equal(myFn(1), 2));
});
```

Node 24 сам відкидає типи, тож тестового фреймворку немає. Runtime-імпорт через `@/` у
модулі, який тестуєш, не спрацює під `node --test` — роби такі модулі самодостатніми.
Типи тестів перевіряє `tsconfig.test.json`.

## 2. Браузер

Підняти локально: бекенд `cd backend && uv run uvicorn flame.main:app --port 8000` (без
`--reload` на Windows), фронт `cd frontend && npm run dev` → http://localhost:5173. Без даних
(`data/build/flame.duckdb`) UI-ендпоінти віддають 503 — див. `docs/development.md`.

Для кожної зміненої сторінки:

- [ ] **Десктоп**: вигляд відповідає варіанту з `docs/design/README.md`.
- [ ] **375 px**: немає горизонтального скролу. Швидкий спосіб — завантажити маршрут в
  `<iframe>` шириною 375 px і порівняти `contentDocument.documentElement.scrollWidth` з
  `clientWidth`; щоб знайти винуватця — шукай елементи з `getBoundingClientRect().right`
  більшим за ширину.
- [ ] **Консоль чиста** (без помилок і попереджень React про ключі).
- [ ] **Стани**: завантаження («Loading …»), помилка (`.placeholder` з `role="alert"`), порожньо.
- [ ] **Клавіатура**: усе клікабельне досяжне Tab-ом, фокус видно.
- [ ] **reduced motion**: анімації зупиняються.
- [ ] **Посилання й якорі** ведуть куди треба (у т.ч. `#section` після завантаження даних).

## 3. Дизайн-система

- [ ] Кольори лише через токени; синій лише для активного/«живого».
- [ ] Жодних `border-radius`, `box-shadow`, градієнтів.
- [ ] Кнопки — `.btn` / `.btn.ghost`; одна головна дія на екран.
- [ ] Фінали — через `EndMark` (колір + значок).
- [ ] Числа з одиницями; моноширинний шрифт для чисел у таблицях.
- [ ] Цілі кліку ≥ 44 px.

## 4. Домен

- [ ] Жодного захардкодженого числа-статистики в JSX чи `content.ts`.
- [ ] Похідне підписано `derived`, наше обчислене — `estimate`.
- [ ] Disruption = «self-extinction not observed».
- [ ] Нитку не змішано з вільними краплями без явного вибору.
- [ ] Відсутній контент — `<Placeholder>`, не вигадка.

## 5. Документи

Змінив маршрути, API-контракт чи структуру фіч — онови `docs/architecture.md` у тому ж PR;
вибрав інший варіант макета — `docs/design/README.md`.
