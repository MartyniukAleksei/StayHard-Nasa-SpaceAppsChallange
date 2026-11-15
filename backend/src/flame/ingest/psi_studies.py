"""Знімки п'яти досліджень PSI поруч із FLEX: завантаження в flame.duckdb і перевірка.

    uv run python -m flame.ingest.psi_studies --verify            # усі наявні знімки
    uv run python -m flame.ingest.psi_studies --verify cfi samer  # лише ці

Знімки приходять архівом `psi-studies-v1.zip` (реліз `data-psi-studies-v1`) і лежать у
`$DATA_DIR/<slug>/` з тією самою будовою, що `data/flex/`: `<slug>.duckdb` (tests, test_files,
ts_<kind>), CSV, timeseries/, raw/, docs/, media/, about.json, manifest.json.
Опис: docs/data/psi-studies.md.

У flame.duckdb кожне дослідження стає окремою схемою з тим самим іменем (`cfi.tests`,
`cfig.ts_telemetry` …): таблиці копіюються 1:1, без змін даних. FLEX лишається в `main`
(на нього спирається API), а схема `flex` містить view на ці таблиці — тож запит
`<slug>.tests` однаковий для всіх досліджень. Реєстр досліджень — таблиця `main.studies`.

Знімок, якого немає на диску, пропускається з попередженням: без архіву збирається лише FLEX.
"""

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import duckdb

from flame.core.config import settings
from flame.core.studies import PSI_STUDIES

# Порядок = порядок у реєстрі. FLEX (PSI-69) збирає build_db окремо, у схемі main.
STUDIES = PSI_STUDIES

REGISTRY_COLUMNS = (
    "slug",
    "accession",
    "acronym",
    "title",
    "doi",
    "license",
    "dataset",
    "test_key",
    "n_tests",
    "tables",
)


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def registry_row(
    con: duckdb.DuckDBPyConnection, slug: str, accession: str, test_key: str, study_dir: Path
) -> dict[str, Any]:
    """Рядок для main.studies: метадані з about.json / manifest.json, таблиці зі схеми slug."""
    about, manifest = _read_json(study_dir / "about.json"), _read_json(study_dir / "manifest.json")
    tables = [
        r[0]
        for r in con.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY 1",
            [slug],
        ).fetchall()
    ]
    n_tests = None
    if "tests" in tables:
        (n_tests,) = con.execute(f'SELECT count(*) FROM "{slug}".tests').fetchone()
    return {
        "slug": slug,
        "accession": accession,
        "acronym": about.get("investigationAcronym") or slug.upper(),
        "title": about.get("title", ""),
        "doi": manifest.get("doi") or about.get("doi", ""),
        "license": manifest.get("license") or about.get("licenseIdentifier", ""),
        "dataset": manifest.get("dataset", ""),
        "test_key": test_key,
        "n_tests": n_tests,
        "tables": tables,
    }


def load(con: duckdb.DuckDBPyConnection, data_dir: Path) -> list[dict[str, Any]]:
    """Копіює таблиці кожного наявного знімка в схему `<slug>`. Повертає рядки реєстру."""
    rows = []
    for slug, study in STUDIES.items():
        study_dir = data_dir / slug
        src = study_dir / f"{slug}.duckdb"
        if not src.exists():
            print(f"warning: немає {src}, дослідження {slug} пропущено")
            continue
        alias = f"src_{slug}"
        con.execute(f"ATTACH '{src.as_posix()}' AS {alias} (READ_ONLY)")
        try:
            con.execute(f'DROP SCHEMA IF EXISTS "{slug}" CASCADE')
            con.execute(f'CREATE SCHEMA "{slug}"')
            tables = con.execute(
                "SELECT table_name FROM information_schema.tables"
                " WHERE table_catalog = ? AND table_schema = 'main' ORDER BY 1",
                [alias],
            ).fetchall()
            for (t,) in tables:
                con.execute(f'CREATE TABLE "{slug}"."{t}" AS SELECT * FROM {alias}.main."{t}"')
        finally:
            con.execute(f"DETACH {alias}")
        rows.append(registry_row(con, slug, study.accession, study.test_key, study_dir))
    return rows


def write_registry(con: duckdb.DuckDBPyConnection, rows: list[dict[str, Any]]) -> None:
    con.execute(
        """CREATE OR REPLACE TABLE studies (
            slug VARCHAR PRIMARY KEY, accession VARCHAR, acronym VARCHAR, title VARCHAR,
            doi VARCHAR, license VARCHAR, dataset VARCHAR, test_key VARCHAR, n_tests BIGINT,
            tables VARCHAR[])"""
    )
    con.executemany(
        f"INSERT INTO studies VALUES ({', '.join('?' * len(REGISTRY_COLUMNS))})",
        [[r[c] for c in REGISTRY_COLUMNS] for r in rows],
    )


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify(study_dir: Path) -> tuple[int, list[str]]:
    """Звіряє файли знімка з manifest.json. Повертає (кількість файлів, список проблем)."""
    files = _read_json(study_dir / "manifest.json").get("files", {})
    problems = []
    for rel, meta in files.items():
        p = study_dir / rel
        if not p.exists():
            problems.append(f"missing {rel}")
        elif _sha256(p) != meta["sha256"]:
            problems.append(f"sha256 mismatch {rel}")
    return len(files), problems


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--verify", action="store_true", help="звірити знімки з manifest.json")
    ap.add_argument("slugs", nargs="*", help=f"дослідження: {', '.join(STUDIES)} (за замовч. усі)")
    args = ap.parse_args()
    if not args.verify:
        ap.error("вкажіть --verify")
    if unknown := set(args.slugs) - set(STUDIES):
        ap.error(f"невідомі дослідження: {', '.join(sorted(unknown))}")
    failed = False
    for slug in args.slugs or STUDIES:
        study_dir = settings.study_dir(slug)
        if not (study_dir / "manifest.json").exists():
            print(f"{slug}: немає {study_dir}/manifest.json — пропущено")
            continue
        n, problems = verify(study_dir)
        print(f"{slug}: {n - len(problems)}/{n} OK")
        for p in problems[:20]:
            print(f"  {p}")
        failed |= bool(problems)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
