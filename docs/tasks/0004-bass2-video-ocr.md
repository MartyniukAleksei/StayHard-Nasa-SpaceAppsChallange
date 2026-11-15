# 0004 · BASS-II: часові ряди з відео для всіх тестів

**Статус:** готово до запуску · **Виконавець:** будь-хто з командою або агент (Antigravity, дешева модель) · **Код:** `backend/src/flame/ingest/bass2_video.py` · **Результат:** `backend/src/flame/studies/bass2/video_series.json`

## Навіщо

На кожному відео BASS-II бортова система впечатувала рядок даних: витрату N₂, швидкість повітря, напругу вентилятора, радіометр і годинник GMT. Таблицею NASA цього не опублікувала. Скрипт читає ці числа з кадрів (шаблонний OCR) і рахує яскравість полум'я в кадрі. На сайті з цього будується таймлайн тесту, синхронний з відео (сторінка тесту, картки на огляді BASS-II).

Зараз ряди є для 7 тестів. Задача — прогнати решту: основне відео з накладкою є в PSI для 122 тестів (~17 ГБ).

## Що робить скрипт (код змінювати не треба)

Для кожного тесту: бере основне відео з PSI → качає його паралельними Range-запитами → ffmpeg, 2 кадри/с → розпізнає накладку → звіряє ступені вентилятора й повітря з журналом NASA (Додаток A звіту) → **видаляє відео** → пише `data/bass2_video/<test>.json`. Наприкінці збирає `video_series.json` (лише тести зі статусом `ok`) і звіт `data/bass2_video/report.md`.

- Перерваний прогін продовжується з місця зупинки: готові тести пропускаються.
- На диску одночасно лежить лише одне відео (до 250 МБ).
- Час: швидкість PSI дуже різна, ~150 КБ/с – 1.5 МБ/с. Увесь прогін — від ~4 до ~30 годин. Обробка одного тесту — секунди.

## Кроки

```bash
git clone https://github.com/MartyniukAleksei/nasa-2026.git && cd nasa-2026
git switch -c data/bass2-video-ocr
cd backend
uv sync                      # uv: https://docs.astral.sh/uv/ (curl -LsSf https://astral.sh/uv/install.sh | sh)

# 1. перевірка на двох малих тестах (~5 хв): обидва мають бути "ok"
uv run --with imageio-ffmpeg python -m flame.ingest.bass2_video --tests B13 T21

# 2. увесь прогін (години). Якщо обірвався — просто запусти ту саму команду ще раз
uv run --with imageio-ffmpeg python -m flame.ingest.bass2_video --all
#    або паралельно в 3 терміналах (швидше, якщо мережа дозволяє), потім зібрати:
#    ... --all --shard 1/3   |   ... --all --shard 2/3   |   ... --all --shard 3/3
#    uv run --with imageio-ffmpeg python -m flame.ingest.bass2_video --export

# 3. перевірки
uv run pytest tests/test_bass2.py tests/test_bass2_video.py
uv run ruff check . && uv run ruff format --check .
```

Файл зі списком відео (`data/bass2/test_files.csv`) скрипт сам дістає з релізу `data-psi-studies-v1`, якщо його немає локально. Ffmpeg приходить разом з `--with imageio-ffmpeg`.

## Чого очікувати у звіті

| Статус | Значення |
|---|---|
| `ok` | накладка є, годинник узгоджений, ступені збігаються з журналом → іде на сайт |
| `check` | щось не так (напр. мало кадрів із накладкою або ступені не збіглися) → **не** йде на сайт, переглядає людина |
| `no_video` | у PSI немає основного відео. Очікувано для B17, F2, O20, O21, O22, P8, P10 |
| `failed` | помилка (мережа, немає накладки). Очікувано для O10: у PSI є лише другий ракурс без накладки |

## Правила для виконавця

- **Не змінюй код** (`backend/src`, `frontend`, тести). Якщо щось падає не на одному тесті, а постійно, — зупинись і надішли останні 50 рядків виводу.
- Не чіпай `data/` у git (папка в `.gitignore`), `flame.duckdb`, Railway, змінні, релізи GitHub.
- У коміт іде **лише** `backend/src/flame/studies/bass2/video_series.json`. Звіт `data/bass2_video/report.md` встав у опис PR.
- Відкрий PR у `main` з гілки `data/bass2-video-ocr`, **не мерджи**.

## Що надіслати назад

1. Посилання на PR.
2. Звіт `report.md` (таблиця всіх тестів).
3. Скільки тестів `ok` / `check` / `no_video` / `failed` і скільки часу зайняв прогін.

## Промпт для агента (вставити в Antigravity як є)

```
You are running a long, mechanical data job in the repo MartyniukAleksei/nasa-2026. Do not write or edit any code.

Follow docs/tasks/0004-bass2-video-ocr.md exactly:
1. Clone the repo, create branch data/bass2-video-ocr from main, run `uv sync` in backend/.
2. Smoke test: `uv run --with imageio-ffmpeg python -m flame.ingest.bass2_video --tests B13 T21`. Both must end "ok". If not, STOP and report the output.
3. Full run: `uv run --with imageio-ffmpeg python -m flame.ingest.bass2_video --all`. It takes hours. If the process stops (network, sleep), run the same command again; finished tests are skipped.
4. Run `uv run pytest tests/test_bass2.py tests/test_bass2_video.py` and `uv run ruff check .`.
5. Commit ONLY backend/src/flame/studies/bass2/video_series.json, push the branch, open a PR to main with data/bass2_video/report.md pasted into the description. Do NOT merge.

Rules: never modify files under backend/src, frontend or tests; never touch Railway, releases or data/ in git.
If the same error repeats for many tests in a row, stop and send the last 50 lines of output instead of trying to fix it.
Some tests are expected to be "no_video" (B17, F2, O20, O21, O22, P8, P10) or "failed" (O10) — that is fine.
Final answer: PR link, the counts of ok / check / no_video / failed, total run time.
```
