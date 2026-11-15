"""Збирає flame.duckdb з знімка FLEX.

    uv run python -m flame.ingest.build_db

Що робить:
1. Копіює таблиці з data/flex/flex.duckdb (tests, test_files, ts_*).
2. Нормалізує tests.test_date: у джерелі дати змішані «11/27/09» і «11/27/2009», тож
   read_csv_auto частину рядків читає з роком 9/10/11. Такі роки переносимо в 20xx.
3. Кладе about.json у таблицю study_about (одне джерело для API, без читання файлів у рантаймі).

TODO: таблиця `chunks` (RAG) з ембеддингами, індекс vss.
"""

import shutil

import duckdb

from flame.core.config import settings

STUDY = "flex"
TWO_DIGIT_YEAR_LIMIT = 100  # рік < 100 означає, що «09» прочитано як 0009


def normalize(con: duckdb.DuckDBPyConnection) -> int:
    """Виправляє дворозрядні роки в tests.test_date. Повертає кількість виправлених рядків."""
    (n,) = con.execute(
        "SELECT count(*) FROM tests WHERE year(test_date) < ?", [TWO_DIGIT_YEAR_LIMIT]
    ).fetchone()
    con.execute(
        "UPDATE tests SET test_date = test_date + INTERVAL 2000 YEAR WHERE year(test_date) < ?",
        [TWO_DIGIT_YEAR_LIMIT],
    )
    return n


def load_about(con: duckdb.DuckDBPyConnection, about_text: str) -> None:
    con.execute("CREATE OR REPLACE TABLE study_about (study VARCHAR PRIMARY KEY, about JSON)")
    con.execute("INSERT INTO study_about VALUES (?, ?)", [STUDY, about_text])


def main() -> None:
    src = settings.flex_dir / "flex.duckdb"
    about = settings.flex_dir / "about.json"
    if not src.exists() or not about.exists():
        raise SystemExit(
            f"Немає {src} або {about}. Спершу: uv run python -m flame.ingest.psi_flex --verify"
        )
    out = settings.duckdb_path
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp.duckdb")
    tmp.unlink(missing_ok=True)
    shutil.copyfile(src, tmp)
    with duckdb.connect(str(tmp)) as con:
        fixed = normalize(con)
        load_about(con, about.read_text(encoding="utf-8"))
        tables = [r[0] for r in con.execute("SHOW TABLES").fetchall()]
        con.execute("CHECKPOINT")
    tmp.replace(out)
    print(f"{out}: {', '.join(tables)} (test_date fixed: {fixed})")


if __name__ == "__main__":
    main()
