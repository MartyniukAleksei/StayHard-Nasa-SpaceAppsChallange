# 0001 · Головна сторінка: Огляд FLEX за макетом 1B «Хаб»

**Статус:** зроблено як 1B; у [0002](0002-pages-1a-2b-3a-4a-5b.md) Огляд перероблено на **1A**, `/` тепер лендінг · **Макет:** [layouts_flex.html → «1 · Огляд», варіант 1B](../design/layouts_flex.html#p1) · **Стиль:** [stayhard-ds.html](../design/stayhard-ds.html), дайджест у [design/README.md](../design/README.md) · **Зміст блоків:** [student_flow_flex.md → [1] Огляд](../product/student_flow_flex.md)

## Мета

За 30 секунд пояснити студенту, що таке FLEX, і **на першому екрані** дати питання, на які дані вже відповідають, разом з відповіддю-цифрою. Це критерій «швидко знайти відповідь».

## Маршрут

`/studies/flex` — сторінка Огляду. `/` поки що редиректить сюди, бо дослідження одне. Нинішній `HomePage` зі статусом API прибираємо, а статус переносимо в футер одним рядком.

## Структура сторінки (зверху вниз, desktop)

| # | Блок | Мітка | Вміст | Джерело |
|---|---|---|---|---|
| 0 | Шапка | — | `Flame in Freefall` (IBM VGA) · чип `FLEX ▾` · Overview / Tests / Compare / Library · поле пошуку-агента — **заглушка**: видиме, `disabled`, плейсхолдер «Ask about flames in microgravity — agent coming soon» | статичне; посилання на ще не готові сторінки неактивні (пунктир) |
| 1 | Hero, ліворуч (≈1.3 fr) | A | питання дослідження одним реченням + 1 речення пояснення + 4 показники: **274 tests · 2 fuels · 3 diluents · ISS 2009–2011** | `about.json` + агрегати з `tests` |
| 1 | Hero, праворуч | G | replay тесту **№35**: canvas-фактура (ASCII) краплі й полум'я з виміряних рядів, повзунок часу, підпис «animation from measured data · #35». Відео немає | `ts_*` для test 35 |
| 2 | Питання → відповіді (сітка 3×2) | D + L5 | 6 карток-пресетів: питання + велике число + розклад за фіналами; клік веде в Дослідник з фільтрами (поки сторінки немає — картка неактивна) | `tests`, див. «Пресети» |
| 3 | Три колонки | B · D · Q | **How it worked:** крапля → запалювання → кулясте полум'я → `d² = d₀² − K·t` → 3 фінали. **What was found:** 3 висновки, кожен з посиланням на тест і публікацію (DOI). Поки команда їх не підібрала, блок показує **нагадування-плейсхолдер** (див. нижче). **2 traps:** «Disruption ≠ would burn forever», «extinguished ≠ safe (cool flames)» | B, Q — кураторський текст; D — `about.json` (публікації) |
| 4 | Згорнуті рядки | A | ▸ Objective, hypothesis, team · ▸ How to cite: DOI 10.60555/mbq8-0451 + кнопка `[ Copy ]` | `about.json` |
| 5 | Футер | — | CC0 + DOI FLEX · атрибуція шрифту IBM VGA (CC BY-SA 4.0, VileR) · статус API | статичне + `/api/health` |

**Мобільна версія (375 px):** усе в одну колонку в порядку hero-текст → пресети → replay → B → D → Q → згорнуте. Пресети йдуть одразу після hero, бо це головне.

## Пресети (D + L5)

Визначення пресетів живуть у конфігу на бекенді, числа рахує SQL. Цифри у фронтенді не захардкоджені. За замовчуванням **лише вільні краплі** (`ts_fiber = 'No'`). Скільки тестів з ниткою або з невідомим статусом нитки, показуємо окремим рядком дрібно.

| Питання | Фільтр | Контроль: усі / вільні краплі |
|---|---|---|
| Does the flame go out by itself in ISS air? | `diluent='N2'`, `x_o2≈0.21 (±0.006)`, `0.9<p_atm<1.1` | 29 (E14·D11·C4) / 21 (E10·D8·C3) |
| How does it burn in a "lunar" atmosphere (≈0.7 atm, ≥30% O₂)? | `p_atm<0.85`, `x_o2≥0.30` | 17 (E0·D15·C2) / 13 (E0·D11·C2) |
| CO₂ or He: which extinguishes better? | `diluent IN ('CO2','He')`, дві колонки | CO₂ 123 / 99 · He 50 / 41 |
| What are cool flames? | прапорець cool flame | 52 / 40 |
| Check the d² law yourself: "clean" tests | вільна крапля, `end_type≠'Disruption'`, є ряди краплі й полум'я | 161 |
| Methanol or heptane? | групування за `fuel` | M 157 (E126·D23·C8) · H 117 (E60·D38·C19) |

Контрольні числа пораховані зі знімка даних, вшитого в `layouts_flex.html`. Використовуємо їх в асертах тестів бекенду.

- **Cool flame** — це наш прапорець, виведений з тексту коментаря дослідника (`ts_comment`), а не колонка NASA. У UI його позначаємо як derived. Правило виведення (ключові слова) описуємо в `docs/data/flex.md`.
- **«Clean» 161** у каркасі захардкоджено. Треба відтворити SQL-ом і, якщо число зміниться, оновити цю таблицю.

## Бекенд

Модуль `studies/flex`: router → service → repository, SQL лише в `repository.py`, параметризований.

- `GET /api/studies/flex/overview` →
  `{ about: {title, acronym, accession, objective, hypothesis, approach, hardware, years, contacts[], doi, license}, facts: {n_tests, fuels[], diluents[], years}, presets: [{id, question, filter, total, by_end: {Extinction, Completion, Disruption}, fiber_excluded}] }`
- `GET /api/studies/flex/tests/{id}/replay` → `{ test_no, end_type, burn_time_s, droplet: [[t_s, d_mm]], flame: [[t_s, d_mm]] }`, тільки `t ≥ 0`, із проріджуванням до ≤ 500 точок.
- Звідки береться `about.json`: зараз він лежить у `data/flex/`, а не в DuckDB. Читати його в рантаймі чи класти в БД під час `build_db`, вирішуємо в межах задачі. Перевага на боці таблиці `study_about` в `build_db`, бо так буде одне джерело.

## Фронтенд

- `src/shared/styles/tokens.css` — токени StayHard. `global.css` переписуємо під DS: темна тема, прямі кути, кнопки-дужки, теги, показники.
- Шрифт IBM VGA дістаємо з `stayhard-ds.html` (base64 woff) у `src/shared/assets/fonts/ibm-vga.woff`. Geist і Geist Mono беремо з Google Fonts.
- `src/shared/ui/` — примітиви `Button`, `Tag`, `Stat`, `Collapsible`, `AsciiCanvas` (порт `render()` / `lum()` з DS, з паузою поза екраном і при reduced motion).
- `src/features/study-overview/` — `useOverview`, `Hero`, `PresetGrid`, `HowItWorked`, `Findings`, `Traps`, `Citation`. Назовні видно лише `index.ts`.
- `src/features/replay/` — `useReplay(id)`, `DropletReplay` (canvas + повзунок; радіуси інтерполюються з рядів, «flame out» після `burn_time_s`).
- `src/pages/StudyOverviewPage.tsx` — тонка сторінка, лише компонування.

## Доменні правила, які перевіряємо

- Кожне число на сторінці приходить з API. Похідне (cool flame, «clean», replay) підписане як derived або estimate.
- Disruption описуємо як «self-extinction not observed», ніде не пишемо «burns forever».
- Нитку не змішуємо з вільними краплями (див. «Пресети»).
- DOI FLEX видно на сторінці, і його можна скопіювати.

## Критерії готовності

- [ ] `/studies/flex` відповідає 1B на desktop і має одноколонковий порядок на 375 px без горизонтального скролу.
- [ ] Пресети показують числа з API, і вони збігаються з контрольними (тести бекенду).
- [ ] Replay №35 відтворює ряди, повзунок працює, при `prefers-reduced-motion` анімації немає.
- [ ] Стиль відповідає StayHard: токени, шрифти, жодних заокруглень, тіней і градієнтів, синій лише для активного.
- [ ] Тексти UI англійською.
- [ ] `uv run pytest`, `ruff`, `npm run build` проходять. Оновлено `docs/architecture.md` (API) і `docs/data/flex.md` (правило cool flame).

## Рішення (2026-11-15)

1. **«What was found» — нагадування.** Поки висновки не підібрані, блок рендерить плейсхолдер у пунктирній рамці (стиль «неактивне» з DS): `TODO (team): add 3 findings — each with a test № and a publication DOI`. Висновки лежать у конфігу (`findings: []`). Якщо масив порожній, показується нагадування, а не вигадані тексти. **Перед демо плейсхолдер треба прибрати.**
2. **Кольори фіналів** — кольором: токени `--end-ext` / `--end-com` / `--end-dis` у `tokens.css`, завжди разом зі значком (● ○ ◇). У картках пресетів розклад за фіналами виглядає як `● 14 Ext · ◇ 11 Dis · ○ 4 Com`. Правила — у [design/README.md](../design/README.md).
3. **Мова** — лише англійська, без перемикача.
4. **Пошук у шапці** — показуємо заглушкою: поле видно, воно `disabled` і має підказку «agent coming soon».

## Відкриті питання до команди

1. **Три висновки «What was found»**: які саме, з якими тестами й DOI публікацій? (поки замість них нагадування, див. «Рішення»)
