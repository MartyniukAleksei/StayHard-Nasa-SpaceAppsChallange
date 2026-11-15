# Набір сцени: архітектура і шаблони

Еталон — `frontend/src/features/experiment-3d/` (FLEX). Читай його код, а не прототип `prototypes/experiment-3d/` (там старий стиль і немає фолбеків).

## Зміст
1. Карта файлів еталона: що загальне, що FLEX-специфічне
2. Перевикористання без копіпасти
3. Будова нової фічі
4. Шаблони: дані → Experiment, годинник, шар-оболонка, апаратура, кадри
5. Вбудовування в сторінку
6. Бекенд: коли сцені бракує даних

## 1. Карта файлів еталона

| Файл | Що робить | Для нового дослідження |
|---|---|---|
| `lib/series.ts` | `toTrack` (TimeSeries → колонки Float64Array, сортування, заповнення пропусків), `sample(track, col, t, clamp)` (лінійна інтерполяція, `null` поза діапазоном), `presence` (плавна поява/зникнення) | **загальне**, без змін |
| `lib/playback.ts` | `Playback`: годинник `t`, play/pause/seek/speed, `active` (стоп поза екраном), `usePlayback` через `useSyncExternalStore` | **загальне**, без змін |
| `lib/keyframes.ts` | час кадрів камери від нуля, вибір ≤ N ключових кадрів, найближчий кадр | **загальне**, якщо кадри мають `start_time` + `t_ms` |
| `components/flameMaterial.ts` | шейдер тонкої сферичної оболонки: яскравий лімб, прозорий центр, шум | **загальне** для будь-якої сферичної оболонки (полум'я, хмара, фронт) |
| `lib/log.ts` | нуль часу й події з журналу `<CIR>.txt` | загальне для CIR/MDCA (CFI — та сама установка); для іншої установки — свій парсер |
| `lib/experiment.ts` | збирає `Experiment`: треки, події, `tMin/tMax`, `flameEnd`, `dropletPosition` | **FLEX-специфічне**: пиши своє за тим самим зразком |
| `api.ts` | хуки TanStack Query: тест, ряди (404 = «нема ряду»), журнал, камери, індекс кадрів | зразок; шляхи свого дослідження |
| `components/Experiment3D.tsx` | WebGL-перевірка, фолбек 2D, `ErrorBoundary`, `lazy(Scene)`, reduced motion, `IntersectionObserver` | зразок оболонки; копіюй структуру |
| `components/Scene.tsx` | `Canvas`, світло, оточення, Bloom, камера, що супроводжує тіло, лінійка масштабу, `Trail` | зразок; `World` своє |
| `components/Apparatus.tsx` | голки, запалювачі, нитка, камера CIR | для CIR/MDCA можна перевикористати; інакше — своє |
| `components/Timeline.tsx`, `Readouts.tsx`, `FramesPanel.tsx` | шкала часу, числа, кадри | зразок; свої ряди й підписи |

## 2. Перевикористання без копіпасти

Фічі не імпортують нутрощі одна одної (`frontend/src/features/README.md`), а `experiment-3d/index.ts` експортує лише `Experiment3D`. Тому:

- **Перше дослідження після FLEX** робить окремий маленький PR «extract 3D kit»: переносить загальні файли з таблиці вище до `frontend/src/shared/three/` (`series.ts`, `playback.ts`, `keyframes.ts`, `flameMaterial.ts` + їхні тести), а `experiment-3d` імпортує їх звідти. Без зміни поведінки; перевірка — `npm test`, `npm run build` і скриншот FLEX replay до/після. Це спільний код, тому окремий PR (правило `CLAUDE.md`).
- Перед цим перевір: можливо, хтось уже зробив це (`ls frontend/src/shared/three`). Тоді просто імпортуй.
- Якщо PR з виносом ще не змерджений, не копіюй файли в нову фічу «тимчасово» — постав свою гілку поверх гілки виносу або дочекайся мерджу. Копії розходяться, і баг, виправлений у FLEX, лишиться в копії.
- Апаратуру CIR/MDCA (камера згоряння, голки, запалювачі) для CFI теж варто винести в спільне (`shared/three/cir/`), бо це та сама установка. Розміри і їхні джерела переносяться разом із коментарями.

## 3. Будова нової фічі

```
frontend/src/features/<slug>-3d/
  index.ts                 export { <Acronym>3D } from "./components/<Acronym>3D";
  api.ts                   use<Acronym>Experiment(testNo): pending | error | empty | ready
  types.ts                 дзеркало Pydantic-схем бекенду
  lib/experiment.ts        build<Acronym>Experiment(test, series, timing) → Experiment | null
  lib/experiment.test.ts   node:test: null без головного ряду, tMin/tMax, кінець даних, позиція
  components/<Acronym>3D.tsx   оболонка (WebGL, фолбек, lazy, reduced motion, offscreen)
  components/Scene.tsx     Canvas + World
  components/Apparatus.tsx (якщо апаратура своя)
  components/Timeline.tsx, Readouts.tsx, FramesPanel.tsx
  components/<slug>-3d.css префікс класів свій (напр. .c3d-)
```

Тести: `npm test` запускає `node --test "src/**/*.test.ts"` (Node сам знімає типи). Імпорти в тестах з розширенням `.ts` (див. `lib/series.test.ts`). Тестуй чисту логіку в `lib/`; сцену перевіряєш візуально.

## 4. Шаблони

### Дані → Experiment

```ts
export interface Experiment {
  test: TestDetail;               // умови з таблиці tests, не з коментарів
  main: Track;                    // головне тіло (крапля); без нього сцени нема
  shells: Record<string, Track | null>; // оболонки/шари, кожен зі своїм рядом
  ignitionEpochMs: number | null; // бортовий час t = 0, для кадрів
  events: Record<string, number | null>; // події з журналу, с від нуля
  tMin: number; tMax: number;     // діапазон відтворення (з паспорта)
  dataEnd: number | null;         // кінець даних шарів: після нього шари не малюються
}

/** null: нема головного ряду, відтворювати нічого. */
export function buildExperiment(test, series, timing): Experiment | null {
  const main = toTrack(series.droplet);
  if (!main) return null;
  // ...
}
```
Правила: `null`, а не підставні значення; кожна функція положення документує, звідки кожна вісь і що це оцінка.

### Шар-оболонка, керований рядом

```tsx
function Shell({ track, col, playback, core, rim, seed }: ShellProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => createFlameMaterial(core, rim), [core, rim]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    const m = mesh.current; if (!m) return;
    const d = sample(track, col, playback.t);      // null поза рядом → шар зникає
    const alpha = presence(track, playback.t);      // художня поява/зникнення 0.25–0.3 с
    m.visible = d != null && alpha > 0;
    if (d != null) m.scale.setScalar(d / 2);        // 1 одиниця = 1 мм, діаметр → радіус
    material.uniforms.uOpacity.value = alpha;
    material.uniforms.uTime.value = clock.elapsedTime + seed;
  });
  return <mesh ref={mesh} material={material} visible={false}><sphereGeometry args={[1, 96, 96]} /></mesh>;
}
```
Розмір і видимість — у `useFrame` через ref, не через стан React: 60 перерендерів на секунду вбивають продуктивність. HUD (readout, фаза, шкала) підписується на годинник через `usePlayback`.

### Подія апаратури з журналу

```ts
const smooth = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
// момент — з журналу (дані); тривалість руху — схематична константа з коментарем
const out = events.needlesRetract == null ? 1 : smooth((t - events.needlesRetract) / NEEDLE_TRAVEL_S);
```
Якщо події в журналі нема, елемент стоїть у кінцевому положенні, а не рухається за вигаданим розкладом.

### Константи геометрії

Кожна константа розміру має коментар з джерелом або словом «schematic»:
```ts
// CIR chamber, NASA/TM—2005-213973: inner diameter 0.40 m, length 0.78 m, eight windows.
const CHAMBER_RADIUS = 200; // mm
const DOME_DEPTH = 60;      // mm, schematic: not given in the report
```

### Кадри камер

Якщо `/api/media/<slug>/{n}/cameras` є: час кадру = `start_time + t_ms − нуль`, ≤ 48 ключових кадрів на камеру, ≤ 2 запити одночасно (бекенд тягне кадр з PSI 1–2 с), застарілий кадр напівпрозорий. Без журналу (нема нуля) кадри не показуємо і кажемо чому. Важкі камери (≈2 МБ на кадр) не показуємо.

## 5. Вбудовування

- На сторінці тесту: вкладка в `MediaBlock` (див. як підключено `Experiment3D`, `TAB_3D`). Сторінка тесту нового дослідження може ще не існувати — тоді спершу сторінка (окрема задача), або тимчасовий маршрут з `?test=N` лише в dev.
- Вкладка 3D не за замовчуванням: three.js (≈290 КБ gzip) вантажиться лише при відкритті.
- У порівнянні тестів (compact) 3D не показуємо.

## 6. Бекенд: коли сцені бракує даних

Сцена читає тільки API. Якщо потрібного ряду нема в API:
1. Ряд є в знімку `data/<slug>/timeseries/` → задача бекенду: таблиця в `build_db` (і модуль у `BUILD_SOURCES`), `studies/<slug>/{fields,repository,service,router}`, `sources` у кожній відповіді через `flame/core/citations.py` (додай accession → slug у `STUDY_SLUGS`, зараз там лише `PSI-69: flex`). Окремий PR перед сценою.
2. Ряду нема в знімку → сцена його не показує. Нові сирі дані — лише через відповідального за дані і новий реліз `data-<slug>-vN`.
3. Ніколи не рахуй «дані» в браузері з інших даних без позначки «estimate» і без запису в паспорті.
