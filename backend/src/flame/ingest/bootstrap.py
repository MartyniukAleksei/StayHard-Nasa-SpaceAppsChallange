"""Заповнює $DATA_DIR при старті контейнера (Railway Volume), якщо він порожній.

    python -m flame.ingest.bootstrap

1. Немає flex/manifest.json і задано DATA_ARCHIVE_URL → качає zip, розпаковує в DATA_DIR.
2. Немає flame.duckdb → flame.ingest.build_db.
Ідемпотентний: на заповненому Volume нічого не робить, тож безпечний перед кожним стартом.
"""

import shutil
import urllib.request
import zipfile

from flame.core.config import settings
from flame.ingest import build_db


def main() -> None:
    data = settings.data_dir
    if not (settings.flex_dir / "manifest.json").exists():
        if not settings.data_archive_url:
            print("bootstrap: no FLEX data and DATA_ARCHIVE_URL is not set — skipping")
            return
        data.mkdir(parents=True, exist_ok=True)
        archive = data / "flex.zip.part"
        print(f"bootstrap: downloading {settings.data_archive_url}", flush=True)
        with urllib.request.urlopen(settings.data_archive_url) as r, archive.open("wb") as f:
            shutil.copyfileobj(r, f, length=1 << 20)
        print("bootstrap: extracting", flush=True)
        with zipfile.ZipFile(archive) as z:
            z.extractall(data)
        archive.unlink()
    if not settings.duckdb_path.exists():
        build_db.main()
    print("bootstrap: data ready", flush=True)


if __name__ == "__main__":
    main()
