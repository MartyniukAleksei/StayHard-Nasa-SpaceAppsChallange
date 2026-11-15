# Дані CFI (PSI-39): що є, що в знімку, як зібрати

> CFI = **PSI-39** (Cool Flames Investigation, МКС, 2017). Та сама установка CIR/MDCA, що й у FLEX: нумерація тестів продовжує FLEX (`Flex Number` 1206–1431), формати файлів ті самі.
> Ліцензія CC0-1.0. Цитувати DOI з `data/cfi/about.json`.

## 1. Що є в PSI

Загалом **2 812 файлів, ≈719 ГБ**. Майже весь обсяг займають архіви кадрів камер (`<CIR>A|C|D.zip`, до 3.5 ГБ кожен) і великі mp4.

### Список тестів: зведення науковців, а не «Experimental table»
- **`Science Documents/CFI_DataSummary_Spreadsheet_Jan2021.xlsx`** — основа. **226 тестів**, аркуші:
  - `Master Sheet` — умови: CIR, тиск, O₂/N₂/He, нитка, паливо;
  - `DATA` — D0, Dext гарячого й холодного полум'я, K_hot, K_cool, перезапалювання, радіація;
  - `Igniter` — потужність і час запалювання;
  - `Comments` — коментар дослідника.
- **`Experimental table/CFI.csv`** (таблиця PSI): лише 87 рядків, з них **79 унікальних** (1285–1297 задубльовано). Скрипт звіряє її з xlsx за CIR, тиском, O₂, He і ниткою: розбіжностей 0. У `tests` вона залишає лише прапорець `in_psi_table`.

| | Тестів | D0 / K_hot | K_cool | Нитка (так) |
|---|---|---|---|---|
| dodecane | 79 | 73 | 64 | 45 |
| dodecane/isododecane (60/40 і 75/25) | 103 | 74 | 62 | 57 |
| farnesane | 44 | 0 | 0 | — (не вказано) |

Тиск 0.5–5 атм, O₂ 0.17 або 0.21, розбавник N₂ або He (0.29 / 0.59).

### Сирі дані на тест (`Raw Data`, `Analyzed Data`)
Файли за CIR-ID (`F068A03_*`) є у **122 тестів**. Повний набір, як у FLEX (`FLEX-NNNN_*`: TestSheet, DropletData, ColorCamData, RadiometerData, Summary.pdf), є лише у **~23 тестів**, усі вони на н-додекані.

| `kind` | Файл | Що всередині | Тестів |
|---|---|---|---|
| `testsheet_txt` | `FLEX-NNNN_TestSheet.txt` | умови, D0, kavg, нитка, коментар | 22 |
| `droplet_ts` | `FLEX-NNNN_DropletData.txt` | t, d (+ x, y для вільних крапель; на нитці лише t, d) | 23 |
| `flame_color_ts` | `FLEX-NNNN_ColorCamData.txt` | t, діаметр гарячого полум'я, standoff | 24 |
| `cool_flame_ts` | `FLEX-NNNN_CoolFlameData.txt` | t, діаметр холодного полум'я (FWHM і peak-to-peak) | 17 |
| `radiometer_ts` | `FLEX-NNNN_RadiometerData.txt` | t, потужність випромінювання (широка й вузька смуга), Вт | 23 |
| `summary_pdf` | `FLEX-NNNN_Summary*.pdf` | графіки тесту від NASA | ~25 |
| `chamber_ts` | `<CIR>_Chamber_Readings.txt` | тиск (psia) і 4 термопари, 1 Гц | 122 |
| `radiometer_raw` | `<CIR>_Radiometer_Readings.txt` | сирі радіометри | 122 |
| `testpoint_log`, `comments`, `*_settings`, `filter_positions`, `camera_index_txt` | службові txt | протокол, налаштування камер, індекси кадрів | ~120 |
| `camera_images_zip` | `<CIR>A|C|D.zip` | кадри камер | шар C (по API) |
| `video` | `*.mp4` | запис з борту | у `media/` лише файли ≤ 60 МБ (15 тестів) |

### Відомі проблеми
- 5 індексів камер (`F173E03A.txt`, `F195D07D.txt`, `F205D01C/D.txt`, `F163A04D.txt`) PSI віддає з 404, тому в знімку їх немає.
- `FLEX-1248_TestSheet.rtf` і `FLEX-1248_Summary.pdf` пошкоджені в самому PSI (не PDF/RTF), скрипт їх пропускає (`KNOWN_BAD`).
- Тиск у таблицях записаний текстом (`"1 atm "`, `".75 atm"`), паливо — формулою (`"[.60]/[.40] C12H26/iso-dodecane"`). Скрипт нормалізує обидва поля, оригінал палива зберігається в `fuel_raw`.
- У farnesane-тестів немає ні прапорця нитки, ні D0/K.
- Там, де є обидва джерела, умови TestSheet (нитка, D0, kavg) збігаються з xlsx.

## 2. Знімок `data/cfi/`

Будова як у `data/flex/` (див. [flex.md](flex.md)), збирає його `flame.ingest.psi_cfi`:

```
about.json  manifest.json  tests.csv  test_files.csv  cfi.duckdb
timeseries/{droplet,flame_color,cool_flame,radiometer,chamber}/NNNN.csv  + <kind>_all.csv
raw/NNNN/…   docs/<категорія>/…   media/NNNN/…
```

Розмір ≈ 0.8 ГБ, з них mp4 ≈ 0.5 ГБ. Без `--videos` знімок займає ≈ 0.28 ГБ.

### Схема `cfi.duckdb`

**`tests`**: 1 рядок = 1 тест.
`test_no, cir_id, test_date, test_time_local, fuel (dodecane|dodecane/isododecane|farnesane), x_dodecane, fuel_raw, p_atm, x_o2, x_n2, x_he, diluent (N2|He), fiber`
\+ з `DATA`: `d0_mm, dext_hot_mm, k_hot_mm2_s, k_cool_mm2_s, dext_cool_mm, reignitions, cool_flame_extrapolated, hot_flame_burn_time_s, peak_hot_flame_rad_w, peak_water_vapor_rad_w, analysis_completed`
\+ `ignition_power_w, ignition_time_ms, in_psi_table, comment`
\+ з TestSheet: `ts_pressure_atm, ts_temperature_k, ts_fiber, ts_kavg_mm2_s, ts_d0_mm, ts_dext_mm, ts_comment`
\+ прапорці: `has_testsheet, has_droplet_ts, has_flame_color_ts, has_cool_flame_ts, has_radiometer_ts, has_chamber_ts, has_summary_pdf, n_videos, min_video_mb, image_zips_gb, n_files_psi`

**`test_files`**: `test_no, cir_id, match, category, kind, camera, name, bytes, version, subfolder, key`. Колонка `match` показує, як файл прив'язано до тесту: `flex_name`, `cir_name`, `flex_folder` або `cir_folder`.

**Часові ряди** (ключ `test_no`):
- `ts_droplet(t_s, d_mm, x_mm, y_mm)`
- `ts_flame_color(t_s, flame_d_mm, standoff)`
- `ts_cool_flame(t_s, d_fwhm_mm, d_p2p_mm)`
- `ts_radiometer(t_s, wide_w, narrow_w)`
- `ts_chamber(timestamp, p_psia, T1_C..T4_C)`

```sql
-- K гарячого й холодного полум'я для вільних крапель додекану
SELECT test_no, p_atm, x_o2, x_he, d0_mm, k_hot_mm2_s, k_cool_mm2_s FROM tests
WHERE fuel = 'dodecane' AND NOT fiber AND k_cool_mm2_s IS NOT NULL ORDER BY p_atm;
-- діаметр холодного полум'я в часі
SELECT t_s, d_fwhm_mm FROM ts_cool_flame WHERE test_no = 1213 ORDER BY t_s;
```

### Доменні правила (як у FLEX)
- Тести на нитці (`fiber = true`) не змішувати з вільними краплями.
- Числа беремо з `tests` (тобто з xlsx), коментар використовуємо лише як опис того, що відбувалося.

## 3. Як зібрати

```bash
cd backend
uv run python -m flame.ingest.psi_cfi --videos 60      # з PSI API → data/cfi/
uv run python -m flame.ingest.psi_cfi --src <дзеркало>/PSI-39_CFI --videos 60   # з локальної копії, решту докачає
uv run python -m flame.ingest.psi_cfi --verify          # «N/N OK»
```

Роздача команді йде так само, як для FLEX: data-власник пакує `data/cfi` у `cfi-v1.zip` і публікує реліз `data-cfi-v1`.

## 4. Що ще не підключено
Знімок поки що автономний: `build_db`, `bootstrap`, API і RAG його не читають. Наступні кроки, кожен окремим PR:
1. Спільний код: `settings.cfi_dir`; `build_db` копіює таблиці `cfi.duckdb` у схему `cfi` в `flame.duckdb`; `bootstrap` уміє кілька архівів (нова змінна для URL CFI — рішення власника інфраструктури).
2. `studies/cfi` (fields → schemas → repository → service → router), `rag/sources/cfi.py`, `"PSI-39": "cfi"` у `core/citations.STUDY_SLUGS`.
