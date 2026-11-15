# 0002 · Лендінг з вибором досліджень + сторінки FLEX 1A · 2B · 3A · 4A · 5B

**Статус:** у роботі (зупинено 2026-11-15, гілка `feat/home-overview`) · **Макети:** [layouts_flex.html](../design/layouts_flex.html), [flex-landing.html](../design/flex-landing.html) · **Стиль:** [design/README.md](../design/README.md) · **Попереднє:** [0001](0001-home-overview-1b.md) (Огляд зроблено як 1B; за цим завданням його переробляємо на 1A)

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

- [x] `flame.ingest.psi_catalog` → закомічений `studies/catalog.json`. Accession: FLEX PSI-69, CFI PSI-39, BASS-II PSI-25, SAFFIRE-II PSI-99, SPICE PSI-107, SAME PSI-102. Знайдені перебором PSI API. Інші цікаві: FLEX-2 PSI-68, ACME CFI-G PSI-159, SAME-R PSI-101, SAFFIRE-I/III PSI-98/100.
- [x] `GET /api/studies` — картки досліджень (FLEX active + facts).
- [x] `GET /api/studies/flex/tests` — 274 `TestSummary`. `has_series` = є ряди краплі **і** UV-полум'я; `has_video` = є локальний mp4.
- [x] `GET /api/studies/flex/tests/{id}` — повний паспорт + `neighbors` (5) + `files` + `videos`.
- [x] `GET /api/studies/flex/tests/{id}/replay` — додано `standoff`.
- [x] `GET /api/studies/flex/tests/{id}/series.csv` — усі точки з БД, у шапці цитата з DOI.
- [x] `GET /api/studies/flex/library` — цитата, 51 публікація, NASA-документи за категоріями, `limitations`. Обмеження: нитка 54 / вільні 212 / невідомо 8, Disruption 61, без d₀ 12, без K 16, без рядів 20, з відео 12.
- [x] `GET /api/media/flex/{path}` — лише `raw/`, `media/`, `docs/`, перевірка `resolve()` + `is_relative_to` (traversal → 404). mp4 з Range (206), це вміє Starlette 1.10.
- [ ] Оновити `docs/architecture.md`: нові ендпоінти, `media`, каталог.

### Фронтенд — ⏳ приблизно половина; `tsc` проходить, у браузері нові сторінки ще **не перевірені**

Зроблено (файли є, але ще не підключені до маршрутів):
- [x] `shared/lib/format.ts` (`num`, `pct`, `chem`, `bytes`, `fiberLabel`), `shared/lib/useWidth.ts`.
- [x] `shared/ui/Placeholder.tsx` (TODO-нагадування), `shared/ui/chart/TimeChart.tsx` + `chart.css` (SVG: растрові крапки, лінії, маркер «flame out», курсор).
- [x] `features/flex-tests`: типи, хуки `useTests` / `useTest` / `useTestsDetail` / `useLibrary`, `mediaUrl`, `seriesCsvUrl`, `compare.ts` (`parseIds`, `compareHref`, `MAX_COMPARE = 3`).
- [x] `features/explorer` (2B):
  - `lib/filter.ts`: фасети, межі смуг збігаються з SQL пресетів, за замовчуванням лише вільні краплі; стан у URL; `presetHref`;
  - `Facets`, `AnswerCard`, `TestMap` (O₂ × розбавник/тиск), `TestTable` (сортування, галочки compare), `Preview`, `Explorer`, `explorer.css`.
- [x] `features/test-page` (3A): `TestReport` (заголовок + Q-прапорці → What happened TODO → Watch → d² → діаметри → параметри → коментар → схожі → файли), `MediaBlock` (вкладки відео / replay), `FileList`, `test.css`.
- [x] `features/compare` (4A): `Compare` (до 3 колонок, спільні осі d², поле «Add test №», попередження про змішування класів нитки, TODO «How they differ»), `compare.css`. На мобільному scroll-snap.
- [x] `features/replay/api.ts`: додано `useReplays`.

Залишилось:
1. [ ] `shared/ui/CopyButton.tsx`. Винести копіювання з `study-overview/components/AboutDetails.tsx` і використати там і в Бібліотеці.
2. [ ] `features/library` (5B):
   - `content.ts` (словник полів `tests` і рядів, теми публікацій);
   - `Library.tsx` зі sticky-меню якорів: How to cite · Lab cart (TODO) · Data dictionary · Limitations · Publications (чипи-теми, derived) · NASA documents (`FileList` з `test-page`).
3. [ ] `features/landing`:
   - порт `drawSky` / `drawCosmos` з `flex-landing.html` у `lib/sky.ts` (пауза поза екраном і при reduced motion);
   - hero «Deep dive into space» + Start → `#studies`;
   - `StudyCards` з `/api/studies` (FLEX → `/studies/flex`; решта — пунктир, «coming soon», DOI).
4. [ ] Огляд 1B → **1A**. Вертикальний порядок: A hero + мета-рядок → G replay №35 на всю ширину → B How it worked → D findings (TODO) → D+L5 пресети (картки стають посиланнями `presetHref(group.id)`) → Q traps → A citation + паспорт. Прибрати мобільний CSS `order` з `overview.css`; `chem()` у `Hero.tsx` замінити на `shared/lib/format`.
5. [ ] `app/router.tsx`:
   - `/` → лендінг (зараз редирект на `/studies/flex`);
   - нові сторінки `pages/{Landing,Tests,Test,Compare,Library}Page.tsx`;
   - `TestPage` бере `:id` з `useParams`.
6. [ ] `app/Layout.tsx`:
   - навігація `[Overview] [Tests] [Compare] [Library]` у дужках з `aria-current`;
   - кнопка `Cart · 0` неактивна;
   - пошук-заглушка;
   - на `/` без FLEX-навігації;
   - чип FLEX веде на `/`.
7. [ ] `vitest` + тести для `explorer/lib/filter.ts` (зокрема: пресет «ISS air» дає 21 вільний тест, «clean» дає 161) і `replay/lib/frame.ts`.
8. [ ] Документи:
   - `design/README.md`: вибрані варіанти 1A / 2B / 3A / 4A / 5B + `flex-landing.html`;
   - `architecture.md`;
   - індекс `docs/README.md`;
   - у `0001` позначка «перероблено на 1A».
9. [ ] Перевірка в браузері, на десктопі й у iframe на 375 px, кожен маршрут:
   - немає горизонтального скролу, консоль чиста;
   - відео тесту з `has_video` грає;
   - Summary.pdf відкривається;
   - пресет з Огляду відкриває Дослідник з тими самими числами;
   - галочки → Порівняння з `?ids=`.
10. [ ] `npm run build`, `uv run pytest`, `ruff`; потім PR.

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
