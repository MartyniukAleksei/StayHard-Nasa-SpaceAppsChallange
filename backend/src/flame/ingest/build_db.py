"""Збирає flame.duckdb з знімка FLEX.

    uv run python -m flame.ingest.build_db

Поточний стан: копіює таблиці з data/flex/flex.duckdb (tests, test_files, ts_*).
TODO: нормалізація, таблиця `chunks` (RAG) з ембеддингами, індекс vss.
"""

import shutil

import duckdb

from flame.core.config import settings


def main() -> None:
    src = settings.flex_dir / "flex.duckdb"
    if not src.exists():
        raise SystemExit(f"Немає {src}. Спершу: uv run python -m flame.ingest.psi_flex --verify")
    out = settings.duckdb_path
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp.duckdb")
    tmp.unlink(missing_ok=True)
    shutil.copyfile(src, tmp)
    with duckdb.connect(str(tmp)) as con:
        tables = [r[0] for r in con.execute("SHOW TABLES").fetchall()]
        con.execute("CHECKPOINT")
    tmp.replace(out)
    print(f"{out}: {', '.join(tables)}")


if __name__ == "__main__":
    main()
