"""Збирає flame.duckdb з знімка FLEX.

    uv run python -m flame.ingest.build_db

Поточний стан: копіює таблиці з data/flex/flex.duckdb (tests, test_files, ts_*)
і будує RAG-індекс `chunks` (flame.rag.index; ембеддинги перевикористовуються зі старої БД).
TODO: нормалізація.

Версія збірки (`BUILD_VERSION`) — хеш коду, від якого залежить вміст БД (`BUILD_SOURCES`).
Вона пишеться в таблицю `meta`; bootstrap перезбирає БД на проді, коли версія в коді
змінилась. Додаєш модуль, що впливає на вміст БД, — додай його в `BUILD_SOURCES`.
"""

import hashlib
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path

import duckdb

from flame.core.config import settings
from flame.rag import index as rag_index
from flame.rag.sources import flex as flex_sources

_PKG = Path(__file__).resolve().parents[1]  # src/flame
BUILD_SOURCES = [
    _PKG / "ingest" / "build_db.py",
    *sorted((_PKG / "rag").rglob("*.py")),
]


def _build_version() -> str:
    h = hashlib.sha256()
    for p in BUILD_SOURCES:
        h.update(p.relative_to(_PKG).as_posix().encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:12]


BUILD_VERSION = _build_version()


def read_meta(path: Path) -> dict[str, str]:
    """Метадані зібраної БД; {} якщо файлу/таблиці немає або файл битий."""
    if not path.exists():
        return {}
    try:
        with duckdb.connect(str(path), read_only=True) as con:
            return dict(con.execute("SELECT key, value FROM meta").fetchall())
    except duckdb.Error:
        return {}


def main() -> None:
    src = settings.flex_dir / "flex.duckdb"
    if not src.exists():
        raise SystemExit(f"Немає {src}. Спершу: uv run python -m flame.ingest.psi_flex --verify")
    manifest = json.loads((settings.flex_dir / "manifest.json").read_text(encoding="utf-8"))
    out = settings.duckdb_path
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp.duckdb")
    tmp.unlink(missing_ok=True)
    shutil.copyfile(src, tmp)
    with duckdb.connect(str(tmp)) as con:
        rag_meta = rag_index.build(con, flex_sources.iter_documents(settings.flex_dir), old_db=out)
        con.execute("CREATE OR REPLACE TABLE meta (key VARCHAR PRIMARY KEY, value VARCHAR)")
        con.executemany(
            "INSERT INTO meta VALUES (?, ?)",
            [
                ("build_version", BUILD_VERSION),
                ("dataset", manifest.get("dataset", "")),
                ("built_at", datetime.now(UTC).isoformat(timespec="seconds")),
                *rag_meta.items(),
            ],
        )
        tables = [r[0] for r in con.execute("SHOW TABLES").fetchall()]
        con.execute("CHECKPOINT")
    tmp.replace(out)  # атомарна заміна: старий файл читачі дочитують, нові бачать новий
    print(f"{out} [{BUILD_VERSION}]: {', '.join(tables)}")


if __name__ == "__main__":
    main()
