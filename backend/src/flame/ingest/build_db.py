"""Збирає flame.duckdb з знімка FLEX.

    uv run python -m flame.ingest.build_db

Що робить:
1. Копіює таблиці з data/flex/flex.duckdb (tests, test_files, ts_*).
2. Нормалізує tests.test_date: у джерелі дати змішані «11/27/09» і «11/27/2009», тож
   read_csv_auto частину рядків читає з роком 9/10/11. Такі роки переносимо в 20xx.
3. Кладе about.json (якщо є) у таблицю study_about (одне джерело для API, без читання файлів
   у рантаймі).
4. Копіює знімки інших досліджень PSI (data/<slug>/<slug>.duckdb) у схеми `<slug>`
   (flame.ingest.psi_studies), створює схему `flex` з view на таблиці FLEX і реєстр `studies`.
5. Будує RAG-індекс `chunks` (flame.rag.index; ембеддинги перевикористовуються зі старої БД).

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
from flame.ingest import psi_studies
from flame.rag import index as rag_index
from flame.rag.sources import flex as flex_sources

_PKG = Path(__file__).resolve().parents[1]  # src/flame
BUILD_SOURCES = [
    _PKG / "ingest" / "build_db.py",
    _PKG / "ingest" / "psi_studies.py",
    *sorted((_PKG / "rag").rglob("*.py")),
]


def _build_version() -> str:
    h = hashlib.sha256()
    for p in BUILD_SOURCES:
        h.update(p.relative_to(_PKG).as_posix().encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:12]


BUILD_VERSION = _build_version()

STUDY = "flex"
FLEX_ACCESSION = "PSI-69"
TWO_DIGIT_YEAR_LIMIT = 100  # рік < 100 означає, що «09» прочитано як 0009


def normalize(con: duckdb.DuckDBPyConnection) -> int:
    """Виправляє дворозрядні роки в tests.test_date. Повертає кількість виправлених рядків."""
    cols = {r[0] for r in con.execute("DESCRIBE tests").fetchall()}
    if "test_date" not in cols:  # неповний знімок (напр. фікстура тестів)
        return 0
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


def add_flex_schema(con: duckdb.DuckDBPyConnection) -> list[str]:
    """Схема `flex` з view на таблиці FLEX у `main`: `flex.tests` ≡ `main.tests` тощо."""
    tables = [
        r[0]
        for r in con.execute(
            "SELECT table_name FROM information_schema.tables"
            " WHERE table_schema = 'main' AND table_type = 'BASE TABLE'"
            " AND (table_name IN ('tests', 'test_files') OR starts_with(table_name, 'ts_'))"
            " ORDER BY 1"
        ).fetchall()
    ]
    con.execute("DROP SCHEMA IF EXISTS flex CASCADE")
    con.execute("CREATE SCHEMA flex")
    for t in tables:
        con.execute(f'CREATE VIEW flex."{t}" AS SELECT * FROM main."{t}"')
    return tables


def load_studies(con: duckdb.DuckDBPyConnection) -> dict[str, str]:
    """Інші дослідження в схеми, реєстр `studies`, їхні about.json у `study_about`.
    Повертає {slug: dataset} для таблиці meta."""
    add_flex_schema(con)
    rows = [
        psi_studies.registry_row(con, STUDY, FLEX_ACCESSION, "test_no", settings.flex_dir),
        *psi_studies.load(con, settings.data_dir),
    ]
    psi_studies.write_registry(con, rows)
    con.execute("CREATE TABLE IF NOT EXISTS study_about (study VARCHAR PRIMARY KEY, about JSON)")
    for r in rows[1:]:
        about = settings.study_dir(r["slug"]) / "about.json"
        if about.exists():
            con.execute(
                "INSERT OR REPLACE INTO study_about VALUES (?, ?)",
                [r["slug"], about.read_text(encoding="utf-8")],
            )
    return {r["slug"]: r["dataset"] for r in rows}


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
    about = settings.flex_dir / "about.json"  # без нього Огляд і Бібліотека віддають 503
    manifest = json.loads((settings.flex_dir / "manifest.json").read_text(encoding="utf-8"))
    out = settings.duckdb_path
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp.duckdb")
    tmp.unlink(missing_ok=True)
    shutil.copyfile(src, tmp)
    with duckdb.connect(str(tmp)) as con:
        fixed = normalize(con)
        if about.exists():
            load_about(con, about.read_text(encoding="utf-8"))
        else:
            print(f"warning: немає {about}, у study_about немає FLEX")
        datasets = load_studies(con)
        rag_meta = rag_index.build(con, flex_sources.iter_documents(settings.flex_dir), old_db=out)
        con.execute("CREATE OR REPLACE TABLE meta (key VARCHAR PRIMARY KEY, value VARCHAR)")
        con.executemany(
            "INSERT INTO meta VALUES (?, ?)",
            [
                ("build_version", BUILD_VERSION),
                ("dataset", manifest.get("dataset", "")),
                ("datasets", json.dumps(datasets)),
                ("built_at", datetime.now(UTC).isoformat(timespec="seconds")),
                *rag_meta.items(),
            ],
        )
        tables = [r[0] for r in con.execute("SHOW TABLES").fetchall()]
        con.execute("CHECKPOINT")
    tmp.replace(out)  # атомарна заміна: старий файл читачі дочитують, нові бачать новий
    print(f"{out} [{BUILD_VERSION}]: {', '.join(tables)} (test_date fixed: {fixed})")
    print(f"studies: {', '.join(f'{k}={v}' for k, v in datasets.items())}")


if __name__ == "__main__":
    main()
