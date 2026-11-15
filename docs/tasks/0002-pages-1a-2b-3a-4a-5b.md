# 0002 · Лендінг з вибором досліджень + сторінки FLEX 1A · 2B · 3A · 4A · 5B

**Статус:** зроблено 2026-11-15 (гілка `feat/home-overview`); лишились тексти команди, див. «Перед демо» · **Макети:** [layouts_flex.html](../design/layouts_flex.html), [flex-landing.html](../design/flex-landing.html) · **Стиль:** [design/README.md](../design/README.md) · **Попереднє:** [0001](0001-home-overview-1b.md) (Огляд зроблено як 1B; за цим завданням його переробляємо на 1A)

## Що вирішила команда

Варіанти з `layouts_flex.html`: **1 → 1A** (довга сторінка-розповідь), **2 → 2B** (master–detail), **3 → 3A** (довгий звіт), **4 → 4A** (картки поруч), **5 → 5B** (документація з якорями). FLEX — один із треків, тому потрібен лендінг `/` з вибором дослідження за прикладом `flex-landing.html`. Усе робимо в StayHard і на реальних даних.

### Відповіді з опитування (2026-11-15)

| Питання | Рішення |
|---|---|
| Які картки досліджень на лендінгу | FLEX активний, з числами з БД. CFI, BASS-II, SAFFIRE-II, SPICE, SAME — неактивні «coming soon» з паспортом із PSI API |
| Hero лендінгу | Загальний «Deep dive into space» для всіх треків. Кнопка Start скролить до карток. Числа FLEX — лише в його картці |
| Комети / ASCII-небо | Тільки на лендінгу |
| Блок G (медіа) на тесті і в порівнянні | mp4, якщо є (12 тестів), інакше replay з даних. Replay також доступний окремою вкладкою |
| Графіки | Власний SVG за правилами DS, без бібліотек |
| L5-тексти («що сталося», «чим відрізняються», наш K-фіт) | Поки заглушка-нагадування `TODO (team)` |
| Схожі тести | Рахуємо з даних: те саме паливо, розбавник і клас нитки; найближчі за O₂, тиском і d₀. Позначка derived |
| Кошик лабораторної | Не зараз. Кнопка в шапці — заглушка, у Бібліотеці — нагадування TODO |
| Пошук у шапці | Заглушка |
| Як обирати тести для Порівняння | Галочки в Досліднику, не більше 3. Вибір тримається в URL `?ids=`. На сторінці тесту кнопка «Compare with…» |
| Файли NASA (PDF, txt, mp4) | Віддаємо з Volume через `/api/media/flex/...` |
| Як здавати | Усе одним заходом (план робіт нижче) |

## Маршрути

`/` лендінг · `/studies/flex` огляд 1A · `/studies/flex/tests` дослідник 2B · `/studies/flex/tests/:id` тест 3A · `/studies/flex/compare?ids=` порівняння 4A · `/studies/flex/library` бібліотека 5B.

## Прогрес

### Бекенд — ✅ готово, 24 тести проходять, ruff чистий

> **Злиття з main (PR #8, агентне API з `sources`).** `main` зайняв `/api/studies/flex/tests`, `/tests/{n}` і `/api/media/flex/…` під агента, тож UI-модуль переїхав у `flame.studies.flex.pages`, а два шляхи змінились: список Дослідника — **`/api/studies/flex/explorer`**, сторінка тесту — **`/api/studies/flex/tests/{n}/report`**. Файли — через спільний `/api/media/flex/files/{path}` (`media/files.py`). Актуальна таблиця — у [architecture.md](../architecture.md).

- [x] `flame.ingest.psi_catalog` → закомічений `studies/catalog.json`. Accession: FLEX PSI-69, CFI PSI-39, BASS-II PSI-25, SAFFIRE-II PSI-99, SPICE PSI-107, SAME PSI-102. Знайдені перебором PSI API. Інші цікаві: FLEX-2 PSI-68, ACME CFI-G PSI-159, SAME-R PSI-101, SAFFIRE-I/III PSI-98/100.
- [x] `GET /api/studies` — картки досліджень (FLEX active + facts).
- [x] `GET /api/studies/flex/tests` — 274 `TestSummary`. `has_series` = є ряди краплі **і** UV-полум'я; `has_video` = є локальний mp4.
- [x] `GET /api/studies/flex/tests/{id}` — повний паспорт + `neighbors` (5) + `files` + `videos`.
- [x] `GET /api/studies/flex/tests/{id}/replay` — додано `standoff`.
- [x] `GET /api/studies/flex/tests/{id}/series.csv` — усі точки з БД, у шапці цитата з DOI.
- [x] `GET /api/studies/flex/library` — цитата, 51 публікація, NASA-документи за категоріями, `limitations`. Обмеження: нитка 54 / вільні 212 / невідомо 8, Disruption 61, без d₀ 12, без K 16, без рядів 20, з відео 12.
- [x] `GET /api/media/flex/{path}` — лише `raw/`, `media/`, `docs/`, перевірка `resolve()` + `is_relative_to` (traversal → 404). mp4 з Range (206), це вміє Starlette 1.10.
- [x] Оновити `docs/architecture.md`: нові ендпоінти, `media`, каталог.

### Фронтенд — ✅ готово; `npm run build` і `npm test` (25 тестів) проходять, усі маршрути перевірені в браузері

- [x] `shared/lib/format.ts`, `shared/lib/useWidth.ts`, `shared/ui/Placeholder.tsx`, `shared/ui/CopyButton.tsx` (винесено з Огляду, використовується в Огляді й Бібліотеці), `shared/ui/chart/TimeChart.tsx`.
- [x] `features/flex-tests`: типи, хуки, `mediaUrl`, `seriesCsvUrl`, `compare.ts`.
- [x] `features/explorer` (2B), `features/test-page` (3A), `features/compare` (4A), `features/replay` (+ `useReplays`).
- [x] `features/library` (5B): `content.ts` (словник полів `tests` і `series.csv`, теми публікацій, застереження), `Library.tsx` зі sticky-меню якорів (`#cite`, `#cart`, `#dictionary`, `#limitations`, `#publications`, `#documents`). Обмеження — числа з API; теми публікацій — збіг ключових слів у назві, підписано *derived*.
- [x] `features/landing`: `lib/sky.ts` (порт `drawSky` / `drawCosmos` з `flex-landing.html`), `useSky` (≈11 кадрів/с, пауза поза екраном, при reduced motion — один кадр), hero «Deep dive into space» без чисел, `StudyCards` з `/api/studies` (FLEX активний з фактами; решта — пунктир, «coming soon», DOI).
- [x] Огляд 1B → **1A**: hero + мета-рядок → replay №35 на всю ширину (21:8, на телефоні 4:3) → How it worked → What was found (TODO) → пресети (кожна відповідь — посилання `presetHref`) → пастки → цитування й паспорт. Мобільний CSS `order` прибрано, `chem()` береться з `shared/lib/format`.
- [x] `app/router.tsx`: `/` → лендінг; сторінки `pages/{Landing,Tests,Test,Compare,Library}Page.tsx`; `TestPage` бере `:id` з `useParams`, нечисловий id → NotFound.
- [x] `app/Layout.tsx`: навігація `[Overview] [Tests] [Compare] [Library]` з `aria-current` (дужки в активного), кнопка `Cart · 0` неактивна (на ≤ 600 px схована), пошук — заглушка, на `/` без FLEX-навігації, чип FLEX веде на `/`.
- [x] Тести: замість vitest — `node:test` (`npm test`), бо `npm install` на Windows ламає `package-lock.json` для `npm ci` у Docker. `explorer/lib/filter.test.ts` (межі смуг, URL-стан, фасети + реальні дані з `data/flex/tests.csv`: ISS air 21, clean 161, lunar 13, cool 40, CO₂ 99, He 41 — ті самі числа, що в пресетах), `replay/lib/frame.test.ts`. Типи тестів перевіряє `tsconfig.test.json`.
- [x] Виправлено в `replay/lib/ascii.ts`: canvas перевиділявся лише при зміні ширини, тож при іншій висоті сфера розтягувалась в еліпс.
- [x] Документи: `design/README.md` (вибрані варіанти, `flex-landing.html`), `architecture.md` (API, `studies/`, маршрути фронтенду), `development.md` і `CLAUDE.md` (`npm test`), індекс `docs/README.md`, статус `0001`.
- [x] Перевірка в браузері (десктоп 1707 px і iframe 375 px), кожен маршрут: горизонтального скролу немає, консоль чиста; відео №207 грає; `FLEX-207_Summary.pdf` віддається (206, `application/pdf`); пресет «ISS air» відкриває Дослідник з тими самими 21 (10 · 8 · 3); галочки → `/compare?ids=1,2,3`.

## Перед демо (команда)

- [ ] Прибрати всі `TODO (team)`-плейсхолдери: Findings (3 висновки з № тесту й DOI — `study-overview/content.ts`), What happened (сторінка тесту), наш K-фіт, How they differ (Порівняння), Lab cart (Бібліотека й кнопка в шапці).
- [ ] `docs/data/flex.md`, на який посилаються `CLAUDE.md`, `architecture.md` і `0001`, у репозиторії відсутній — треба повернути або написати (схема таблиць, якість даних, правило cool flame).
- [ ] Дослідник на телефоні: фільтри зараз розгорнуті зверху; у макеті 2B для мобільного — кнопка-шторка.

## Як підняти локально завтра

```bash
# дані (≈540 МБ, якщо ще немає data/flex):
cd backend && DATA_ARCHIVE_URL=https://github.com/MartyniukAleksei/nasa-2026/releases/download/data-flex-v1/flex-v1.zip uv run python -m flame.ingest.bootstrap
uv run python -m flame.ingest.build_db        # обов'язково: нормалізація дат + study_about
uv run uvicorn flame.main:app --port 8000      # без --reload: на Windows WatchFiles не бачить змін
cd ../frontend && npm install && npm run dev   # :5173
```

Після `npm install` на Windows не комітити зміни `package-lock.json` (зникають поля `libc`, і це ламає `npm ci` у Linux-контейнері).

## Зауваги

- Тексти UI — англійською; документи — українською.
- Усі числа на сторінках — з API. Похідне (cool flame, clean, схожі тести, «has series») підписане *derived*.
- Тести з ниткою ніколи не змішуються з вільними краплями без явного вибору; у Порівнянні змішування дає попередження.
- Перед демо прибрати всі `TODO (team)`-плейсхолдери: Findings, What happened, наш K-фіт, How they differ, Lab cart.
