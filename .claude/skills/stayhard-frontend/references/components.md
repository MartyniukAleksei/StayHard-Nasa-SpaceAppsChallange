# Що вже є і що перевикористати

Перед тим як писати новий компонент чи клас, перевір цей список. Шляхи — від `frontend/src`.

## Зміст
1. Токени (`shared/styles/tokens.css`)
2. Глобальні класи (`shared/styles/global.css`)
3. Спільні компоненти й утиліти (`shared/`)
4. Фічі, з яких можна брати (`features/*/index.ts`)
5. Каркас застосунку (`app/`, `pages/`)

## 1. Токени

| Токен | Значення | Для чого |
|---|---|---|
| `--void` | `#050505` | фон, 60–90 % площі; також фон «суцільних» клітинок у canvas |
| `--deep` | `#0e0e0d` | поля, код, поверхні |
| `--line` | `#262624` | рамки 1 px, роздільники (`--rule: 1px solid var(--line)`) |
| `--ash` | `#8d8d88` | підписи, другорядне |
| `--ink` | `#f1f0ea` | текст, форма, головна дія |
| `--flame` | `#4d6bff` | лише активне/«живе» |
| `--paper` / `--soot` | `#ebe5d5` / `#151412` | інверсія для друку/постерів |
| `--end-ext` / `--end-com` / `--end-dis` | `#6fa384` / `#c8735f` / `#c09a52` | фінали тестів, завжди зі значком |
| `--brand`, `--display` | IBM VGA | назва, заголовки |
| `--sans` / `--mono` | Geist / Geist Mono | текст / числа, гліфи, кнопки |
| `--bz` / `--dz` | 0.92 / 1.1 | масштаб назви / заголовків |
| `--gutter` | `max(5vw, 16px)` | бічні поля |
| `--max` | `1240px` | ширина контенту |
| `--hit` | `44px` | мінімальна ціль кліку |

Темна тема — єдина (`color-scheme: dark`). Перемикача теми немає.

## 2. Глобальні класи

| Клас | Що робить |
|---|---|
| `.wrap` | контейнер `--max` з полями `--gutter` |
| `.band` | вертикальна секція; дві поспіль розділяються лінією |
| `.h-display`, `.h-section` | заголовки IBM VGA (h1 / h2) |
| `.lede` | вступний абзац попелом, ≤ 60ch |
| `.muted`, `.small`, `.mono` | попіл, 13 px, моноширинний |
| `.btn`, `.btn.ghost` | кнопка-текст у дужках; головна / другорядна; `[disabled]` = 35 % |
| `.tag`, `.tag.on` | пунктирний тег; активний — суцільна синя рамка + квадратна мітка |
| `.stats` + `.stat > b + span` | сітка показників: велике тонке число + підпис |
| `.cells` + `.cell` | сітка з волосяними лініями 1 px між клітинками |
| `.placeholder` | пунктирна рамка для заглушок і помилок |
| `.end-ext/.end-com/.end-dis` | колір фіналу (через `EndMark`, не напряму) |
| `details > summary`, `details > .body` | розгортання з ▸/▾ |
| `input[type=range]` | повзунок у стилі DS |
| `.sr-only` (у `app/shell.css`) | текст лише для скрінрідера |

## 3. Спільне (`shared/`)

| Що | Імпорт | Примітка |
|---|---|---|
| `apiGet<T>(path)` | `@/shared/api/client` | `fetch` до `${VITE_API_URL}/api…`; кидає `ApiError` |
| `EndMark` | `@/shared/ui/EndMark` | `<EndMark type="Extinction" count={10} short />` → «● 10 Ext»; `END_TYPES` — порядок відображення |
| `Placeholder` | `@/shared/ui/Placeholder` | `<Placeholder>what is missing</Placeholder>` → «TODO (team): …» |
| `CopyButton` | `@/shared/ui/CopyButton` | `<CopyButton text={citation} />`, повідомлення через `role="status"` |
| `TimeChart` | `@/shared/ui/chart/TimeChart` | SVG: `series[{id,label,points,kind:"dots"\|"line",tone}]`, `xLabel`, `yLabel`, `ariaLabel`, `xDomain`/`yDomain` (спільні осі для порівняння), `cursor`, `markers[{x,label}]`; tone: `ink ash flame ext dis com s1 s2` |
| `useWidth()` | `@/shared/lib/useWidth` | `[ref, width]` через ResizeObserver — для SVG з чіткими підписами |
| `num`, `pct`, `chem`, `bytes`, `fiberLabel`, `DASH` | `@/shared/lib/format` | лише форматування: `num(3.851,2,"mm")`, `pct(0.21)` → «21%», `chem("CO2")` → «CO₂», `null` → «—» |

## 4. Фічі (бери лише з їхнього `index.ts`)

| Фіча | Експорт | Для чого |
|---|---|---|
| `flex-tests` | `useTests` (рядки Дослідника), `useTest(id)` (звіт тесту), `useTestsDetail(ids)`, `useLibrary`, `mediaUrl(path)`, `seriesCsvUrl(id)`, `compareHref(ids)`, `testHref(id)`, `parseIds`, `MAX_COMPARE`, типи `TestSummary`, `TestDetail`, `FileItem`, `Library` | будь-які дані FLEX для UI |
| `explorer` | `Explorer`, `presetHref(groupId)` | посилання «відкрити ці тести» з тими самими фільтрами |
| `replay` | `DropletReplay({testNo})`, `useReplay`, `useReplays`, тип `Replay` | ASCII-replay краплі й полум'я з виміряних рядів |
| `test-page` | `TestReport`, `MediaBlock`, `FileList` | список файлів/документів з розмірами й типами |
| `compare` | `Compare` | сторінка порівняння |
| `study-overview` | `StudyOverview`, `useOverview`, типи `Overview`, `Facts` | огляд; `useOverview` також дає DOI для футера |
| `library` | `Library` | сторінка бібліотеки |
| `landing` | `Landing`, `useStudies`, тип `StudyCard` | лендінг, картки досліджень |

Кураторські тексти фічі (без чисел) — у її `content.ts` (див. `study-overview/content.ts`,
`library/content.ts`).

## 5. Каркас

- `app/router.tsx` — маршрути; сторінки під `Layout` (шапка, футер).
- `app/Layout.tsx` — шапка: бренд → `/`, на маршрутах `/studies/flex*` — чип FLEX і навігація
  `[Overview] [Tests] [Compare] [Library]` (NavLink ставить `aria-current`), пошук-заглушка,
  кошик-заглушка (схований ≤ 600 px). Футер: CC0 + DOI, атрибуція шрифту, статус API.
- `app/providers.tsx` — TanStack Query, `staleTime: Infinity` (дані статичні).
- `pages/*Page.tsx` — тонкі обгортки; параметри маршруту читаються тут (`useParams`).
