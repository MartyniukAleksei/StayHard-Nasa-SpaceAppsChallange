"""Карта режимів ACME CFI-G (PSI-159): логіка на фікстурі в пам'яті й контракт на реальній БД."""

import json
from collections.abc import Iterator

import duckdb
import pytest
from fastapi.testclient import TestClient

from flame.db.duckdb import db_available, get_cursor
from flame.main import app
from flame.studies.cfig import service

needs_db = pytest.mark.skipif(not db_available(), reason="flame.duckdb is not built")

ROWS = [
    # test_id, flame_type, fuel, p_bar, x_o2, end_mode, cool_flame_note, comment, has_ts
    (
        "21174C3",
        "normal",
        "butane",
        2.0266,
        0.395,
        "self_extinguished",
        "yes, PCI-D",
        "Cool flame!",
        True,
    ),
    ("21174C2", "normal", "butane", 2.0266, 0.397, "self_extinguished", "no, PCI-hot", "", True),
    ("21088A1", "normal", "ethane", 0.944, 0.394, "self_extinguished", "", "", True),
    ("21196A2", "inverse", "ethane", 1.10, 0.21, "flow_terminated", None, "FC=flow cut", False),
    ("21196A1", "inverse", "ethane", 1.10, 0.21, "", None, "Failed to ignite", False),
]


@pytest.fixture
def con() -> Iterator[duckdb.DuckDBPyConnection]:
    c = duckdb.connect(":memory:")
    c.execute("CREATE SCHEMA cfig")
    c.execute(
        """CREATE TABLE cfig.tests (
            test_id VARCHAR, flame_type VARCHAR, fuel VARCHAR, p_bar DOUBLE, x_o2 DOUBLE,
            x_o2_after DOUBLE, fuel_flow_mg_s DOUBLE, tad_k DOUBLE, zst DOUBLE,
            hot_ignition BOOLEAN, burn_time_s DOUBLE, end_mode VARCHAR, peak_burner_t_c DOUBLE,
            cool_flame_note VARCHAR, comment VARCHAR, has_telemetry_ts BOOLEAN)"""
    )
    for tid, ft, fuel, p, x, end, note, comment, ts in ROWS:
        c.execute(
            "INSERT INTO cfig.tests VALUES (?,?,?,?,?,NULL,2.0,2000,0.1,TRUE,30,?,300,?,?,?)",
            [tid, ft, fuel, p, x, end, note, comment, ts],
        )
    c.execute("CREATE TABLE study_about (study VARCHAR PRIMARY KEY, about JSON)")
    about = {
        "title": "ACME / Cool Flames Investigation with Gases",
        "doi": "10.60555/cyt1-kh64",
        "licenseIdentifier": "CC0-1.0",
        "version": 1,
        "investigationAcronym": "CFI-G",
    }
    c.execute("INSERT INTO study_about VALUES ('cfig', ?)", [json.dumps(about)])
    yield c
    c.close()


@pytest.mark.parametrize(
    ("note", "expected"),
    [("yes, PCI-D", True), ("Yes", True), ("no, PCI-hot", False), ("", None), (None, None)],
)
def test_cool_flame_reads_the_table_column(note: str | None, expected: bool | None) -> None:
    assert service.cool_flame(note) is expected


def test_regime_map_counts_come_from_rows(con: duckdb.DuckDBPyConnection) -> None:
    m = service.get_regime_map(con)

    assert m.facts.n_tests == 5 and m.facts.n_normal == 3 and m.facts.n_inverse == 2
    assert m.facts.fuels == ["butane", "ethane"]
    assert m.facts.n_cool_flame_noted == 1
    assert (m.facts.n_self_extinguished, m.facts.n_flow_terminated) == (3, 1)
    assert [t.test_id for t in m.tests] == sorted(r[0] for r in ROWS)


def test_missing_values_stay_missing(con: duckdb.DuckDBPyConnection) -> None:
    by_id = {t.test_id: t for t in service.get_regime_map(con).tests}

    assert by_id["21196A1"].end_mode is None  # did not ignite: no end mode, not "flow_terminated"
    assert by_id["21196A1"].cool_flame is None  # inverse table has no such column
    assert by_id["21174C2"].cool_flame is False
    assert by_id["21174C3"].comment == "Cool flame!"
    assert by_id["21088A1"].comment is None and by_id["21088A1"].cool_flame_note is None


def test_about_carries_doi_and_license(con: duckdb.DuckDBPyConnection) -> None:
    a = service.get_regime_map(con).about

    assert a.accession == "PSI-159" and a.doi == "10.60555/cyt1-kh64"
    assert a.doi_url == "https://doi.org/10.60555/cyt1-kh64" and a.license == "CC0-1.0"
    assert "10.60555/cyt1-kh64" in a.citation


def test_missing_study_is_reported(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("DROP SCHEMA cfig CASCADE")

    with pytest.raises(service.StudyDataMissing):
        service.get_regime_map(con)


def test_endpoint_serves_the_map(con: duckdb.DuckDBPyConnection) -> None:
    app.dependency_overrides[get_cursor] = lambda: con
    try:
        client = TestClient(app)
        if not db_available():  # require_db guard needs a file; skip the HTTP layer without it
            pytest.skip("flame.duckdb is not built")
        r = client.get("/api/studies/cfig/regime")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    assert r.json()["facts"]["n_tests"] == 5


@needs_db
def test_real_snapshot_matches_the_published_table() -> None:
    m = TestClient(app).get("/api/studies/cfig/regime").json()

    assert m["facts"]["n_tests"] == 333
    assert (m["facts"]["n_normal"], m["facts"]["n_inverse"]) == (179, 154)
    assert m["facts"]["fuels"] == ["butane", "ethane", "propane"]
    assert m["about"]["doi"] == "10.60555/cyt1-kh64" and m["about"]["license"] == "CC0-1.0"
    cool = [t for t in m["tests"] if t["cool_flame"]]
    assert {t["fuel"] for t in cool} == {"butane"}
    assert {t["flame_type"] for t in cool} == {"normal"}
    assert {round(t["p_bar"], 1) for t in cool} == {2.0}
    assert all(0.38 < t["x_o2"] < 0.40 for t in cool)
