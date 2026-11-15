# Як отримати дані FLEX з NASA PSI API (шар «на вимогу»)

Локальний датасет (`data/flex/`: БД + легкі файли) уже містить усе для графіків, replay і RAG.
По API беремо лише **важке**: архіви кадрів з камер (0.2–1.7 ГБ на тест), великі відео, калібрування.

- API публічне, **без ключів і логіну**.
- Дані CC0-1.0, цитуємо DOI FLEX (`data/flex/about.json` → `doi`).
- FLEX = `PSI-69`.

## TL;DR — скачати будь-який файл

1. Знайти файл у `data/flex/test_files.csv` (або в таблиці `test_files` у `flex.duckdb`) → взяти `name` і `version`.
2. Отримати підписане посилання:
   ```
   GET https://psi.nasa.gov/geode-py/ws/studies/PSI-69/download?file=<name>&version=<version>&redirect=false
   ```
   Відповідь — **рядок з URL** на S3 (не JSON).
3. Зробити `GET` по цьому URL. **Посилання живе 1 годину**, тому отримуйте його безпосередньо перед завантаженням.

```bash
NAME="PSI-69_Raw Data_182F001D.zip"; VER=1
URL=$(curl -s -G "https://psi.nasa.gov/geode-py/ws/studies/PSI-69/download" \
  --data-urlencode "file=$NAME" --data-urlencode "version=$VER" --data-urlencode "redirect=false")
curl -L -o "$NAME" "$URL"
```

## Як знайти потрібний файл

```sql
-- duckdb data/flex/flex.duckdb
-- усі файли тесту 31
SELECT kind, camera, name, version, bytes/1e6 AS mb FROM test_files WHERE test_no = '31' ORDER BY kind;

-- архіви кадрів (camera: A = HiBMS 1024², B = LLL-UV 512², D = кольорова 640×480)
SELECT test_no, camera, name, version, bytes/1e9 AS gb FROM test_files WHERE kind = 'camera_images_zip' AND test_no = '31';

-- усі відео, від найменших
SELECT test_no, name, version, bytes/1e6 AS mb FROM test_files WHERE kind = 'video' ORDER BY bytes;
```

Корисні значення `kind`: `camera_images_zip`, `video`, `testsheet_rtf`, `radiometer_ts`, `camera_index_txt`, `other_*`.
Колонка `match` показує, як файл прив'язано до тесту. У PSI частина файлів лежить у чужих папках, тому довіряйте `test_no` з індексу, а не назві папки.

## Python

```python
import urllib.parse, urllib.request

API = "https://psi.nasa.gov/geode-py/ws"

def signed_url(name: str, version: int, acc: str = "PSI-69") -> str:
    q = urllib.parse.urlencode({"file": name, "version": version, "redirect": "false"})
    with urllib.request.urlopen(f"{API}/studies/{acc}/download?{q}", timeout=60) as r:
        return r.read().decode().strip().strip('"')

def download(name: str, version: int, dest: str):
    with urllib.request.urlopen(signed_url(name, version), timeout=600) as r, open(dest, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
```

## Для бекенду: медіа-проксі

Фронт **не ходить у PSI напряму**: є CORS, посилання протухають через годину, а на демо все має бути в кеші.

```python
# FastAPI
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, FileResponse
import duckdb, os

app = FastAPI()
db = duckdb.connect("data/flex/flex.duckdb", read_only=True)
CACHE = "data/cache"

@app.get("/media/{test_no}/{name}")
def media(test_no: int, name: str):
    row = db.execute("SELECT version, bytes FROM test_files WHERE test_no = ? AND name = ?",
                     [str(test_no), name]).fetchone()
    if not row:
        raise HTTPException(404)
    local = os.path.join(CACHE, str(test_no), name)
    if os.path.exists(local):                         # кеш (прогріти до демо!)
        return FileResponse(local)
    return RedirectResponse(signed_url(name, row[0]))  # або стрімити й одночасно класти в кеш
```

Великі zip (1–2 ГБ) **не віддаємо в браузер**.

### Кадри камер: реалізовано (`flame.media`, ADR 0005)
S3 за підписаним посиланням підтримує `Range` (відповідь `206`). Тому бекенд **не качає zip**:
1. читає кінець файлу з центральним каталогом zip (3 Range-запити, ~2 с; розмір файлу береться з `test_files.bytes`);
2. читає вкладений індекс `<CIR><cam>.txt` (час кожного кадру);
3. для кадру `i` бере одним Range-запитом лише його запис (~0.1–1.5 МБ), розпаковує, конвертує 16-біт TIFF / BMP → JPEG.

Каталоги, індекси й останні відрендерені кадри кешуються в пам'яті процесу, а підписане посилання — до його `Expires`. Ендпоінти описано в `docs/architecture.md`.

## Інші ендпоінти (якщо знадобиться)

| Що | Запит |
|---|---|
| Пошук досліджень (по метаданих) | `GET {API}/repo/search?term=flex&source=psi&type=investigation` |
| Метадані дослідження (цілі, підхід, публікації, DOI) | `GET {API}/repo/investigations/PSI-69` |
| Повне дерево файлів | `POST {API}/files/v2` з тілом `{"folder":"","fileType":"study","studyId":"PSI-69","version":<version з метаданих>,"obfuscationcode":""}` |
| Обкладинка дослідження | `GET {API}/investigations/PSI-69/image` |

Повнотекстового пошуку по вмісту файлів API **не має**. Для цього в нас є свій індекс (`test_files`) і RAG.

## Правила
- Не качайте весь `Raw Data` (≈924 ГБ). Беріть файли точково за `test_files`.
- Ставте паралельність ≤ 8 запитів і повтор з паузою при помилці.
- Усе, що качаєте, кладіть у `data/cache/` або `data/derived/`. `data/flex/` лише для читання.
- Сторінка FLEX у PSI: https://psi.nasa.gov/physci/repo/data/investigations/PSI-69
