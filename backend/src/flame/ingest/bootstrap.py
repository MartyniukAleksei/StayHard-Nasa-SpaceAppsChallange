"""Готує $DATA_DIR при старті контейнера (Railway Volume). Ідемпотентний.

    python -m flame.ingest.bootstrap

1. Знімок FLEX: якщо його немає або DATA_ARCHIVE_URL змінився (новий реліз flex-vN) —
   качає zip, замінює $DATA_DIR/flex. Поточний URL зберігається в $DATA_DIR/.archive_url.
2. БД: якщо flame.duckdb немає, знімок оновився або версія збірки в коді
   (build_db.BUILD_VERSION) відрізняється від записаної в БД — перезбирає.
На актуальному Volume нічого не робить.
"""

import shutil
import urllib.request
import zipfile

from flame.core.config import settings
from flame.ingest import build_db


def sync_snapshot() -> bool:
    """Повертає True, якщо знімок було (пере)завантажено."""
    data, url = settings.data_dir, settings.data_archive_url
    marker = data / ".archive_url"
    has_snapshot = (settings.flex_dir / "manifest.json").exists()
    if not url:
        if not has_snapshot:
            print("bootstrap: no FLEX data and DATA_ARCHIVE_URL is not set — skipping")
        return False
    if has_snapshot and not marker.exists():
        marker.write_text(url)  # Volume заповнено до появи маркера — вважаємо актуальним
    if has_snapshot and marker.read_text().strip() == url:
        return False

    data.mkdir(parents=True, exist_ok=True)
    archive = data / "flex.zip.part"
    print(f"bootstrap: downloading {url}", flush=True)
    with urllib.request.urlopen(url) as r, archive.open("wb") as f:
        shutil.copyfileobj(r, f, length=1 << 20)
    print("bootstrap: extracting", flush=True)
    shutil.rmtree(settings.flex_dir, ignore_errors=True)
    with zipfile.ZipFile(archive) as z:
        z.extractall(data)
    archive.unlink()
    marker.write_text(url)
    return True


def main() -> None:
    snapshot_changed = sync_snapshot()
    if not (settings.flex_dir / "manifest.json").exists():
        return
    built = build_db.read_meta(settings.duckdb_path).get("build_version")
    if snapshot_changed or built != build_db.BUILD_VERSION:
        print(f"bootstrap: rebuilding db ({built} → {build_db.BUILD_VERSION})", flush=True)
        build_db.main()
    print(f"bootstrap: data ready [{build_db.BUILD_VERSION}]", flush=True)


if __name__ == "__main__":
    main()
