# Дані FLEX (PSI-69): що є, що в БД, що по API, як ділимось

> FLEX = **PSI-69** (Flame Extinguishment Experiment, МКС, 2009–2012). Не плутати з PSI-68 = FLEX-2.
> Ліцензія CC0-1.0. Цитувати DOI з `data/flex/about.json`.

## 1. Що взагалі є в PSI по FLEX

Загалом **6 555 файлів, ≈924 ГБ**. 99% обсягу — архіви кадрів з камер.

### Таблиця експериментів (1 файл, 25 КБ) — основа всього
274 тести (1 рядок = 1 тест): паливо (метанол 157, гептан 117), тиск (≈0.7 / 1 / 2–3 атм), O₂ (0.12–0.34), N₂, CO₂ (0–0.7), He (0–0.45), d₀ (1.1–4.7 мм), діаметр згасання, K (мм²/с), час горіння, тип завершення (Extinction 186 / Disruption 61 / Completion 27).

### Сирі дані на тест (`Raw Data`)

| Тип (`kind` у test_files.csv) | Файл | Що всередині | На скількох тестах | Розмір |
|---|---|---|---|---|
| `testsheet_txt` | `FLEX-NNN_TestSheet.txt` | умови + **коментар дослідника** (як горіло, що пішло не так), нитка так/ні, K_avg | 266 | ~1 КБ |
| `droplet_ts` | `FLEX-NNN_DropletData.txt` | **t, діаметр краплі, позиція X/Y**, ~30 Гц | 254 | ~40 КБ |
| `flame_color_ts` | `FLEX-NNN_ColorCamData.txt` | t, діаметр полум'я, standoff (кольорова камера) | ~220 | ~15 КБ |
| `flame_uv_ts` | `FLEX-NNN_LLUVData.txt` | t, діаметр полум'я, standoff (UV-камера, бачить OH*) + позиція краплі | ~255 | ~25 КБ |
| `summary_pdf` | `FLEX-NNN_Summary.pdf` | готові графіки тесту від NASA | 254 | ~0.3 МБ |
| `chamber_ts` | `<CIR>_Chamber_Readings.txt` | телеметрія камери: тиск (psia), 4 термопари, 1 Гц | 251 | ~300 КБ |
| `radiometer_ts` | `<CIR>_Radiometer_Readings.txt` | радіометри (випромінювання полум'я), 100 Гц пакетами | ~250 | ~250 КБ |
| `testpoint_log` | `<CIR>.txt` | протокол: час запалювання, таймінги | ~250 | ~15 КБ |
| `testpoint_settings`, `camera_settings` | `*_Settings.txt` | налаштування MDCA і камер (fps, роздільність) | ~250 | <5 КБ |
| `comments` | `<CIR>_Comments.txt` | службові примітки обробки | ~200 | ~5 КБ |
| `camera_index_txt` | `<CIR>A.txt` / `D.txt` | індекс кадрів камер | ~100 | ~100 КБ |
| `testsheet_rtf` | `TestSheet.rtf` | дубль TestSheet з картинками | 268 | ~1 МБ |
| `camera_images_zip` A | `<CIR>A.zip` | кадри **HiBMS** (backlit, 1024×1024, 12 біт, 30 fps) — силует краплі | ~240 | **~1.7 ГБ** |
| `camera_images_zip` B | `<CIR>B.zip` | ймовірно **LLL-UV** (512×512) | ~250 | ~160 МБ |
| `camera_images_zip` D | `<CIR>D.zip` | ймовірно **кольорова камера** (640×480) | ~250 | ~290 МБ |
| `video` | `*.mp4` | запис з борту | **лише ~25 тестів** (23 з них <60 МБ) | 3 МБ – 1.2 ГБ |

> Букви камер A/B/D виведено з `*_Camera_Settings.txt` (IPSU1 = HiBMS, IPSU2 = LLL-UV, IPSU4 = колір). Перевірити на 1–2 архівах.

### Інше
- **Engineering / Science Documents, Presentations** (~15 МБ): вимоги до експерименту, тест-план, «Cool Flames in Space» тощо → для RAG.
- **Calibration** (120 файлів, 5.5 ГБ) — калібрування камер і радіометрів. Нам не потрібне.
- **~1 000 файлів тестів, яких немає в таблиці**: папки `Heptane_Xenon`, `MeOH_Xenon` (ксенон як розбавник) і частина CO₂/He. Бонус на потім: параметри доведеться брати з їхніх txt.

### Відомі проблеми якості
- **Файли лежать не в тих папках** (наприклад, `Flex-008/` містить файли тесту `N05M201` = №218). Тому скрипт прив'язує файл до тесту **за ім'ям файлу** (FLEX-NNN або CIR-ID), а папку використовує лише як запасний варіант. Метод видно в колонці `match`.
- Частина тестів без TestSheet (8), без часових рядів (~20), без d₀ (6). У таблиці `–` означає пропуск.
- Дубль CIR-ID `193F001` для двох тестів.
- **Disruption ≠ «горіло б вічно»**: тест обірвався. Формулювання для UI: «самозгасання не спостерігалось».

## 2. Три шари даних

| Шар | Що | Де живе | Розмір |
|---|---|---|---|
| **A. БД (у всіх однакова)** | `tests` (274 рядки, нормалізовано), `test_files` (індекс усіх 6 555 файлів), часові ряди `ts_droplet`, `ts_flame_color`, `ts_flame_uv`, `ts_chamber` | `data/flex/*.csv` + `flex.duckdb` | ~30–40 МБ |
| **B. Легкі файли (локально)** | TestSheet, Summary.pdf, txt-телеметрія, документи; mp4 до 60 МБ | `data/flex/raw/`, `docs/`, `media/` | ~400–600 МБ |
| **C. По API на вимогу** | архіви кадрів (~900 ГБ), великі mp4, rtf, калібрування | PSI → бекенд-проксі → кеш | — |

**Як отримати файл шару C:** знайти рядок у `test_files` (є `name` і `version`) →
`GET https://psi.nasa.gov/geode-py/ws/studies/PSI-69/download?file=<name>&version=<version>&redirect=false` → у відповіді текстом приходить **підписане S3-посилання** → GET по ньому.
Це робить бекенд (`/media/{test_id}/{file}`) з кешем. Фронт у PSI напряму не ходить.

## 3. Схема БД

**`tests`** — 1 рядок = 1 тест
`test_no, cir_id, test_date, test_gmt, fuel, p_mmhg, p_atm, x_o2, x_n2, x_co2, x_he, x_other, diluent (N2|CO2|He), d0_mm, dext_mm, k_mm2_s, burn_time_s, end_type (Extinction|Disruption|Completion)`
\+ з TestSheet: `ts_pressure_atm, ts_temperature_k, ts_fiber, ts_kavg_mm2_s, ts_d0_mm, ts_dext_mm, ts_comment`
\+ прапорці: `has_droplet_ts, has_flame_color_ts, has_flame_uv_ts, has_chamber_ts, has_summary_pdf, n_videos, min_video_mb, image_zips_gb, n_files_psi`

**`test_files`** — `test_no, cir_id, match, category, kind, camera, name, bytes, version, subfolder, key`

**Часові ряди** (ключ `test_no`, час `t_s` у секундах від запалювання):
- `ts_droplet(t_s, d_mm, x_mm, y_mm)`
- `ts_flame_color(t_s, flame_d_mm, standoff)`
- `ts_flame_uv(t_s, flame_d_mm, standoff, droplet_x_mm, droplet_z_mm)`
- `ts_chamber(timestamp, p_psia, T1_C..T4_C)` — абсолютний час GMT

Приклади запитів:
```sql
-- «місячні» тести
SELECT test_no, fuel, p_atm, x_o2, end_type, k_mm2_s FROM tests WHERE p_atm < 0.75 AND x_o2 >= 0.30;
-- d²(t) для графіка
SELECT t_s, d_mm*d_mm AS d2 FROM ts_droplet WHERE test_no = 2 AND t_s >= 0 ORDER BY t_s;
-- де взяти відео
SELECT test_no, name, bytes/1e6 AS mb FROM test_files WHERE kind='video' ORDER BY bytes;
```

## 4. Як роздати команді однакові дані

**Один збирає, усі завантажують готовий знімок.** Не запускайте збірку вшістьох: так отримаєте різні версії й зайве навантаження на PSI.

### Data-людина (один раз)
```bash
cd backend
uv run python -m flame.ingest.psi_flex --only 2 31 45 --no-docs   # швидка перевірка (1 хв)
uv run python -m flame.ingest.psi_flex --videos 60                 # повна збірка → data/flex/
uv run python -m flame.ingest.psi_flex --verify                    # самоперевірка
cd ..
cd data && zip -r flex-v1.zip flex && cd ..
gh release create data-flex-v1 data/flex-v1.zip -t "FLEX dataset v1" -n "PSI-69, built $(date -u +%F)"
```
(Альтернатива GitHub Release — спільна папка Google Drive.)

### Решта команди
```bash
gh release download data-flex-v1 -p flex-v1.zip -D data && unzip -o data/flex-v1.zip -d data
(cd backend && uv run python -m flame.ingest.psi_flex --verify)   # має бути «N/N OK»
(cd backend && uv run python -m flame.ingest.build_db)             # → data/build/flame.duckdb
```

### Правила
- `data/flex/` — **тільки для читання**. Похідні дані (агрегати, ембеддинги, кадри) — у `data/derived/` і лише скриптами з репо.
- У git комітимо код і `docs/`. `data/` додати в `.gitignore`.
- Помітили помилку в даних → правимо **скрипт**, Data-людина збирає `flex-v2`, оголошує в чаті, усі перекачують.
- Хто працює з бекендом/агентом, читає з `flex.duckdb` (або CSV). Фронт до появи API використовує ті самі CSV як моки.

## 5. Хто що бере з даних

| Роль | Основне |
|---|---|
| Backend | `flex.duckdb`; проксі для шару C через `test_files` |
| Agent | `tests` (фільтри), `ts_comment`, похідні з `ts_*` |
| RAG | `ts_comment`, `docs/*.pdf`, `docs/*.docx`, `about.json` (опис, публікації, DOI). Summary.pdf не індексуємо — лише графіки. Деталі: [rag/techstack.md](../rag/techstack.md) |
| Frontend / Viz | `ts_droplet` + `ts_flame_*` для replay і графіків, mp4 з `media/` |
| Domain | перевірка `end_type`, тестів з ниткою (`ts_fiber`), «місячних» тестів |
