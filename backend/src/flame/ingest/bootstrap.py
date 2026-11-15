"""Готує $DATA_DIR при старті контейнера (Railway Volume). Ідемпотентний.

    python -m flame.ingest.bootstrap

1. Знімки: кожен архів зі списку `settings.archive_urls` (DATA_ARCHIVE_URL + DATA_ARCHIVE_URLS,
   GitHub Releases `data-flex-vN`, `data-psi-studies-vN`) качається, якщо його URL ще не записаний
   у $DATA_DIR/.archives.json. Архів містить каталоги верхнього рівня (`flex/`, `cfi/`, …):
   саме вони замінюються, решта Volume не чіпається. Архіви качаються по одному, і zip
   видаляється одразу після розпакування, щоб на диску не лежало кілька архівів разом.
2. БД: якщо flame.duckdb немає, якийсь знімок оновився або версія збірки в коді
   (build_db.BUILD_VERSION) відрізняється від записаної в БД — перезбирає.
На актуальному Volume нічого не робить.
"""

import json
import shutil
import urllib.request
import zipfile
from pathlib import Path

from flame.core.config import settings
from flame.ingest import build_db

STATE = ".archives.json"  # {url: [каталоги верхнього рівня з цього архіву]}
LEGACY_MARKER = ".archive_url"  # старий формат: один URL архіву FLEX


def _flex_ready() -> bool:
    return (settings.flex_dir / "manifest.json").exists()


def _load_state(data: Path, urls: list[str]) -> dict[str, list[str]]:
    path = data / STATE
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    legacy = data / LEGACY_MARKER
    if legacy.exists():  # Volume від старого bootstrap: там лише FLEX з цього URL
        return {legacy.read_text().strip(): ["flex"]}
    if _flex_ready():  # Volume заповнено до появи маркерів — вважаємо перший архів актуальним
        return {urls[0]: ["flex"]}
    return {}


def _save_state(data: Path, state: dict[str, list[str]]) -> None:
    (data / STATE).write_text(json.dumps(state, indent=1), encoding="utf-8")
    (data / LEGACY_MARKER).unlink(missing_ok=True)


def _install(url: str, data: Path) -> list[str]:
    """Качає архів, замінює каталоги, які він містить. Повертає їхні імена."""
    archive = data / "snapshot.zip.part"
    print(f"bootstrap: downloading {url}", flush=True)
    with urllib.request.urlopen(url) as r, archive.open("wb") as f:
        shutil.copyfileobj(r, f, length=1 << 20)
    try:
        with zipfile.ZipFile(archive) as z:
            tops = sorted({n.split("/", 1)[0] for n in z.namelist() if "/" in n})
            print(f"bootstrap: extracting {', '.join(tops)}", flush=True)
            for top in tops:
                shutil.rmtree(data / top, ignore_errors=True)
            z.extractall(data)
    finally:
        archive.unlink(missing_ok=True)
    return tops


def sync_snapshot() -> bool:
    """Повертає True, якщо хоч один знімок було (пере)завантажено."""
    data, urls = settings.data_dir, settings.archive_urls
    if not urls:
        if not _flex_ready():
            print("bootstrap: no FLEX data and DATA_ARCHIVE_URL(S) is not set — skipping")
        return False
    data.mkdir(parents=True, exist_ok=True)
    state = _load_state(data, urls)
    changed = False
    for url in urls:
        if url in state:
            continue
        state[url] = _install(url, data)
        changed = True
        _save_state(data, state)  # після кожного архіву: перерваний старт продовжить з наступного
    state = {u: state[u] for u in urls}  # архіви, прибрані зі списку, забуваємо (файли лишаються)
    _save_state(data, state)
    return changed


def main() -> None:
    snapshot_changed = sync_snapshot()
    if not _flex_ready():
        return
    built = build_db.read_meta(settings.duckdb_path).get("build_version")
    if snapshot_changed or built != build_db.BUILD_VERSION:
        print(f"bootstrap: rebuilding db ({built} → {build_db.BUILD_VERSION})", flush=True)
        build_db.main()
    print(f"bootstrap: data ready [{build_db.BUILD_VERSION}]", flush=True)


if __name__ == "__main__":
    main()
