# Дані п'яти досліджень PSI поруч із FLEX: CFI, ACME CFI-G, BASS-II, SAME-R, Saffire-II

> Знімки з NASA Physical Sciences Informatics, зібрані 15.11.2026. Ліцензія даних **CC0-1.0**, але цитувати треба DOI дослідження (таблиця нижче, `studies.doi`, `about.json`).
> Знімки доставляються архівом `psi-studies-v1.zip` (GitHub Release `data-psi-studies-v1`) і лежать у `data/<slug>/` поруч із `data/flex/`. У `flame.duckdb` кожне дослідження — **окрема схема**.

## 1. Що є

| slug (= схема) | Дослідження | PSI | DOI | Тестів | Ключ тесту | Часові ряди |
|---|---|---|---|---|---|---|
| `flex` | FLEX, краплі рідкого палива, МКС 2009–2012 | PSI-69 | [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451) | 274 | `test_no` | `ts_droplet`, `ts_flame_color`, `ts_flame_uv`, `ts_chamber` |
| `cfi` | CFI, холодне полум'я крапель, МКС 2017 | PSI-39 | [10.60555/m6pj-a914](https://doi.org/10.60555/m6pj-a914) | 226 | `test_no` (1206–1431) | `ts_droplet` (24), `ts_flame_color` (24), `ts_cool_flame` (17), `ts_radiometer` (24), `ts_chamber` (122) |
| `cfig` | ACME CFI-G, газові полум'я на сферичному пальнику, МКС 2021 | PSI-159 | [10.60555/cyt1-kh64](https://doi.org/10.60555/cyt1-kh64) | 333 | `test_id` | `ts_telemetry` (328 тестів, 5 Гц, 36 каналів) |
| `bass2` | BASS-II, горіння твердих матеріалів, МКС (MSG) 2014–2018 | PSI-25 | [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67) | 129 | `test_id` | немає (у PSI їх немає) |
| `samer` | SAME-R, виявлення диму, МКС 2010 | PSI-101 | [10.60555/2np7-jv14](https://doi.org/10.60555/2np7-jv14) | 108 (66 прогонів) | `test_id`; ряд — `run_no` | `ts_sensors` (65 прогонів, 1 Гц) |
| `saffire2` | Saffire-II, велика пожежа в модулі Cygnus, 2016 | PSI-99 | [10.60555/2chp-m469](https://doi.org/10.60555/2chp-m469) | 9 | `test_id` | `ts_sensors` (9 зразків, 1 Гц, 65 каналів) |

Повний опис колонок кожного дослідження — у `data/<slug>/about.json` (опис PSI) і в документах `data/<slug>/docs/`. CFI детально: [cfi.md](cfi.md). FLEX: [flex.md](flex.md).

## 2. Як запитувати (`flame.duckdb`)

- **Реєстр** `studies`: `slug, accession, acronym, title, doi, license, dataset, test_key, n_tests, tables[]`. Починай з нього: він каже, які дослідження й таблиці є в цій збірці.
- **Таблиці дослідження** — у схемі `<slug>`, 1:1 з `data/<slug>/<slug>.duckdb`: `tests`, `test_files`, `ts_<kind>`. Колонки й значення як у джерелі, нічого не нормалізуємо.
- **FLEX** лежить у `main` (`tests`, `ts_droplet`, …: на них спирається API). Схема `flex` містить view на ці ж таблиці, тож `flex.tests` ≡ `main.tests`.
- `study_about(study, about JSON)` — `about.json` кожного дослідження, ключ `study` = slug.
- `meta.datasets` — JSON `{slug: версія знімка}` (`meta.dataset` лишається версією FLEX).
- **API** (тільки читання, для розробників і посилань агента): `GET /api/studies/{slug}` (реєстр, профіль колонок, ряди, примітки), `…/tests?f=column:op:value&columns=…&sort=…&desc=…&limit=…`, `…/aggregate?f=…&group_by=…&metric=…`, `…/tests/{id}`, `…/tests/{id}/timeseries/{series}?max_points=…`; файли знімка — `/api/media/{slug}/files/{raw|docs|media}/…`. Код: `backend/src/flame/studies/psi/`.
- **Агент** відповідає по всіх п'яти дослідженнях (інструменти `describe_study`, `query_study_tests`, `aggregate_study_tests`, `get_study_test`, `get_study_timeseries_summary`; [agent/README.md](../agent/README.md)). **RAG** містить їхні `about.json` (опис, цілі, підхід, публікації); PDF з `docs/` — лише SAME-R (`PDF_STUDIES` у `rag/sources/psi_studies.py`, [rag/techstack.md](../rag/techstack.md)), решта поки ні.
- **UI**: сторінок для цих досліджень ще немає.

```sql
SELECT slug, acronym, n_tests, tables FROM studies;
SELECT fuel, count(*), avg(k_hot_mm2_s), avg(k_cool_mm2_s) FROM cfi.tests WHERE NOT fiber GROUP BY fuel;
SELECT t_s, d_mm FROM cfi.ts_droplet WHERE test_no = 1206 ORDER BY t_s;
SELECT flame_type, end_mode, count(*) FROM cfig.tests GROUP BY ALL;
SELECT t_s, co2_pct, o2_pct FROM saffire2.ts_sensors WHERE test_id = '2-5' ORDER BY t_s;
SELECT s.* FROM samer.tests t JOIN samer.ts_sensors s USING (run_no) WHERE t.test_id = '52';
```

У коді бекенду це звичайні запити через `get_cursor` з іменем схеми (`FROM cfi.tests`); SQL — лише в `repository.py`, параметризований.

## 3. Будова знімка `data/<slug>/`

| Файл / каталог | Що всередині |
|---|---|
| `<slug>.duckdb` | `tests`, `test_files`, `ts_<kind>` (джерело для `flame.duckdb`) |
| `tests.csv` | 1 рядок = 1 тест: умови, результати, `has_<kind>_ts`, `n_videos`, `n_files_psi` |
| `test_files.csv` | усі файли дослідження в PSI (`name`, `version`, `bytes`, `kind`, `match`) з прив'язкою до тесту |
| `timeseries/<kind>/<тест>.csv`, `timeseries/<kind>_all.csv` | часові ряди по тесту / усі разом |
| `raw/<тест>/` | легкі сирі файли (txt, csv, pdf) |
| `docs/` | звіти, вимоги, презентації, наукові таблиці |
| `media/<тест>/` | mp4 (вибірка) |
| `about.json`, `manifest.json` | метадані PSI; версія знімка й sha256 кожного файлу (крім `.duckdb`) |

У знімку лише «легкий» шар. Архіви кадрів, великі відео й сирі таблиці телеметрії (≈ 3.1 ТБ у PSI) перелічені в `test_files.csv` і качаються з PSI на вимогу ([psi_api.md](psi_api.md)).

## 4. Особливості даних

- **cfi:**
  - тести на нитці (`fiber = true`, 102 тести) не змішувати з вільними краплями (`false`, 55); у 69 тестів `fiber` NULL (усі 44 farnesane, а також 25 інших), тож їх не можна зараховувати ні до тих, ні до інших;
  - у farnesane немає D0/K;
  - тест 1411 має в джерелі дату 2011-09-06, хоча за CIR-ID `F249B10` це 2017-09-06 (у БД — як у джерелі);
  - 7 файлів PSI недоступні (5 індексів камер віддають 404, 2 файли тесту 1248 пошкоджені).
- **cfig:**
  - режими `flame_type` normal (179) і inverse (154);
  - `t_s` телеметрії відраховується від запалювання (`t0_ref`);
  - **частина каналів — сирі вольти** (калібрування в Engineering Implementation Report у `docs/`): переведення в фізичні одиниці — це наша оцінка, і її треба так позначати;
  - 10 тест-точок мають файли, але відсутні в таблиці.
- **bass2:**
  - літера в `test_id` позначає групу PI (B, F, M, O, P, T);
  - налаштування вентилятора й повітря — текст, часто це послідовність змін протягом тесту;
  - відео є для 73 тестів (по одному найменшому mp4), решта є лише в `test_files`;
  - `match = name_typo`: це 2 ProofSheet, у яких в імені `TP08a/b` стоїть нуль замість літери O.
- **samer:**
  - `51` і `51a` — той самий прогін (`run_no` 51), `a` означає вимірювання після старіння диму (`aged_repeat`), тож ряд `ts_sensors` спільний для обох;
  - для прогону 51 немає файлу датчиків;
  - рік 2010 взято з імен файлів;
  - дубль тесту 57 відкинуто.
- **saffire2:**
  - значення з примітками зберігаються текстом у `*_raw`, а число, якщо його вдалося однозначно взяти, — у сусідній колонці;
  - порожній матеріал означає «як вище» (`material_filled_down`);
  - товщина `037 mm` у PSI означає 0.37 мм;
  - O₂ виведено з виміряного CO₂.
- **Загальне:** NULL означає, що в джерелі значення немає або воно неоднозначне. Числа беремо лише з `tests` і `ts_*`, а власні розрахунки позначаємо як оцінку.

## 5. Як отримати локально

```bash
gh release download data-psi-studies-v1 -p psi-studies-v1.zip
```

```bash
unzip psi-studies-v1.zip -d data -x README.md && rm psi-studies-v1.zip
```

```bash
cd backend && uv run python -m flame.ingest.psi_studies --verify   # cfi 2058/2058 OK, cfig 1837, bass2 211, samer 173, saffire2 30
```

```bash
cd backend && uv run python -m flame.ingest.build_db
```

Без знімків `build_db` збирає лише FLEX і пише попередження. На проді знімки розпаковує `flame.ingest.bootstrap` з `DATA_ARCHIVE_URLS` ([deployment.md](../deployment.md)).
Знімок CFI можна також зібрати з PSI скриптом `flame.ingest.psi_cfi` ([cfi.md](cfi.md)); збирачів для інших чотирьох досліджень у репо немає, тож вони оновлюються лише новим релізом.
