import hashlib
import json
from pathlib import Path

import duckdb
import pytest

from flame.core.config import settings
from flame.ingest import build_db, psi_studies


def make_study(data: Path, slug: str = "cfi", dataset: str = "cfi-v1") -> Path:
    """Мінімальний знімок дослідження: <slug>.duckdb, about.json, tests.csv і manifest.json."""
    d = data / slug
    d.mkdir(parents=True)
    with duckdb.connect(str(d / f"{slug}.duckdb")) as con:
        con.execute(
            "CREATE TABLE tests AS SELECT * FROM (VALUES (1206, 'dodecane'), (1207, 'farnesane'))"
            " t(test_no, fuel)"
        )
        con.execute(
            "CREATE TABLE ts_droplet AS"
            " SELECT 1206 AS test_no, 0.5::DOUBLE AS t_s, 0.6::DOUBLE AS d_mm"
        )
    (d / "about.json").write_text(
        json.dumps({"investigationAcronym": "CFI", "title": "Cool Flames"})
    )
    (d / "tests.csv").write_text("test_no,fuel\n1206,dodecane\n1207,farnesane\n")
    files = {
        rel: {"sha256": hashlib.sha256((d / rel).read_bytes()).hexdigest()}
        for rel in ("about.json", "tests.csv")
    }
    manifest = {
        "dataset": dataset,
        "doi": "10.60555/m6pj-a914",
        "license": "CC0-1.0",
        "files": files,
    }
    (d / "manifest.json").write_text(json.dumps(manifest))
    return d


def test_load_copies_tables_into_study_schema(tmp_path: Path) -> None:
    make_study(tmp_path)
    with duckdb.connect() as con:
        rows = psi_studies.load(con, tmp_path)  # інших знімків немає — пропускаються
        assert [r["slug"] for r in rows] == ["cfi"]
        assert rows[0] | {"tables": None} == {
            "slug": "cfi",
            "accession": "PSI-39",
            "acronym": "CFI",
            "title": "Cool Flames",
            "doi": "10.60555/m6pj-a914",
            "license": "CC0-1.0",
            "dataset": "cfi-v1",
            "test_key": "test_no",
            "n_tests": 2,
            "tables": None,
        }
        assert rows[0]["tables"] == ["tests", "ts_droplet"]
        assert con.execute("SELECT fuel FROM cfi.tests ORDER BY test_no").fetchall() == [
            ("dodecane",),
            ("farnesane",),
        ]
        assert con.execute("SELECT d_mm FROM cfi.ts_droplet").fetchall() == [(0.6,)]
        attached = "SELECT database_name FROM duckdb_databases() WHERE NOT internal"
        assert con.execute(attached).fetchall() == [("memory",)]  # джерело від'єднано


def test_verify_reports_changed_and_missing_files(tmp_path: Path) -> None:
    d = make_study(tmp_path)
    assert psi_studies.verify(d) == (2, [])
    (d / "tests.csv").write_text("changed\n")
    (d / "about.json").unlink()
    assert psi_studies.verify(d) == (2, ["missing about.json", "sha256 mismatch tests.csv"])


@pytest.fixture
def data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    data = tmp_path / "data"
    monkeypatch.setattr(settings, "data_dir", data)
    monkeypatch.setitem(settings.__dict__, "flex_dir", data / "flex")
    monkeypatch.setitem(settings.__dict__, "duckdb_path", data / "build" / "flame.duckdb")
    flex = data / "flex"
    flex.mkdir(parents=True)
    (flex / "manifest.json").write_text(
        json.dumps({"dataset": "flex-v1", "doi": "10.60555/mbq8-0451"})
    )
    (flex / "about.json").write_text(json.dumps({"investigationAcronym": "FLEX"}))
    with duckdb.connect(str(flex / "flex.duckdb")) as con:
        con.execute("CREATE TABLE tests AS SELECT 1 AS test_no")
        con.execute("CREATE TABLE ts_droplet AS SELECT 1 AS test_no, 0.0 AS t_s")
    return data


def test_build_db_puts_each_study_in_its_schema(data_dir: Path) -> None:
    make_study(data_dir)
    build_db.main()
    with duckdb.connect(str(settings.duckdb_path), read_only=True) as con:
        query = "SELECT slug, accession, dataset, test_key, n_tests, tables FROM studies"
        assert con.execute(query).fetchall() == [
            ("flex", "PSI-69", "flex-v1", "test_no", 1, ["tests", "ts_droplet"]),
            ("cfi", "PSI-39", "cfi-v1", "test_no", 2, ["tests", "ts_droplet"]),
        ]
        assert con.execute("SELECT count(*) FROM main.tests").fetchone() == (1,)  # FLEX як був
        assert con.execute("SELECT count(*) FROM flex.ts_droplet").fetchone() == (1,)
        assert con.execute("SELECT count(*) FROM cfi.tests").fetchone() == (2,)
        assert {r[0] for r in con.execute("SELECT study FROM study_about").fetchall()} == {
            "flex",
            "cfi",
        }
    meta = build_db.read_meta(settings.duckdb_path)
    assert json.loads(meta["datasets"]) == {"flex": "flex-v1", "cfi": "cfi-v1"}
    assert meta["dataset"] == "flex-v1"


def test_build_db_without_other_studies_builds_flex_only(data_dir: Path) -> None:
    build_db.main()
    with duckdb.connect(str(settings.duckdb_path), read_only=True) as con:
        assert con.execute("SELECT slug FROM studies").fetchall() == [("flex",)]
