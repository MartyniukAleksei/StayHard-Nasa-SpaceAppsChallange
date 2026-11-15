"""Огляд FLEX: логіка пресетів на мініатюрній БД + контрольні числа на зібраній flame.duckdb."""

import duckdb
import pytest
from fastapi.testclient import TestClient

from flame.db.duckdb import db_available
from flame.main import app
from flame.studies.flex import repository as repo
from flame.studies.flex import service

TESTS_DDL = """
CREATE TABLE tests (
  test_no BIGINT, fuel VARCHAR, p_atm DOUBLE, x_o2 DOUBLE, diluent VARCHAR,
  end_type VARCHAR, ts_fiber BOOLEAN, ts_comment VARCHAR, burn_time_s DOUBLE, d0_mm DOUBLE,
  has_droplet_ts BOOLEAN, has_flame_uv_ts BOOLEAN, test_date DATE
)
"""


@pytest.fixture
def cur() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(":memory:")
    con.execute(TESTS_DDL)
    rows = [
        # ISS air: free Extinction, free Disruption, fiber, unknown fiber
        (
            1,
            "Heptane",
            1.0,
            0.21,
            "N2",
            "Extinction",
            False,
            "a cool flame formed",
            5.0,
            3.0,
            True,
            True,
            "2009-11-27",
        ),
        (
            2,
            "Heptane",
            1.0,
            0.21,
            "N2",
            "Disruption",
            False,
            "",
            4.0,
            3.1,
            True,
            True,
            "2010-01-01",
        ),
        (
            3,
            "Methanol",
            1.0,
            0.21,
            "N2",
            "Extinction",
            True,
            "",
            3.0,
            2.0,
            True,
            True,
            "2011-12-08",
        ),
        (
            4,
            "Methanol",
            1.0,
            0.21,
            "N2",
            "Completion",
            None,
            "",
            3.0,
            2.0,
            True,
            False,
            "2011-01-01",
        ),
        # CO2, free
        (
            5,
            "Methanol",
            1.0,
            0.18,
            "CO2",
            "Completion",
            False,
            "cool-flame",
            2.0,
            2.5,
            True,
            True,
            "2010-05-05",
        ),
    ]
    con.executemany("INSERT INTO tests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    con.execute("CREATE TABLE ts_droplet (test_no BIGINT, t_s DOUBLE, d_mm DOUBLE)")
    con.execute(
        "CREATE TABLE ts_flame_uv (test_no BIGINT, t_s DOUBLE, flame_d_mm DOUBLE, standoff DOUBLE)"
    )
    con.executemany(
        "INSERT INTO ts_droplet VALUES (1, ?, ?)", [(-0.5, 3.0), (0.0, 3.0), (1.0, 2.5)]
    )
    con.executemany(
        "INSERT INTO ts_flame_uv VALUES (1, ?, ?, ?)", [(0.0, None, None), (0.5, 12.0, 4.0)]
    )
    yield con
    con.close()


def test_group_counts_only_free_droplets_and_reports_fiber_separately(cur) -> None:
    c = repo.count_group(cur, "iss_air")

    assert c == {
        "total": 2,
        "extinction": 1,
        "completion": 0,
        "disruption": 1,
        "fiber": 1,
        "fiber_unknown": 1,
    }


def test_cool_flame_flag_matches_spelling_variants(cur) -> None:
    assert repo.count_group(cur, "cool_flames")["total"] == 2


def test_clean_excludes_disruption_and_missing_series(cur) -> None:
    # тест 1 — Extinction з рядами; 2 — Disruption; 4 — без UV-ряду і з невідомою ниткою
    assert repo.count_group(cur, "clean_d2")["total"] == 2


def test_facts_years_and_lists(cur) -> None:
    f = repo.get_facts(cur)

    assert (f["n_tests"], f["first_year"], f["last_year"]) == (5, 2009, 2011)
    assert f["diluents"] == ["CO2", "N2"]


def test_replay_drops_negative_time_and_missing_values(cur) -> None:
    r = service.get_replay(cur, 1)

    assert r is not None
    assert r.droplet == [(0.0, 3.0), (1.0, 2.5)]
    assert r.flame == [(0.5, 12.0)]
    assert service.get_replay(cur, 999) is None


def test_downsample_keeps_ends_and_limit() -> None:
    pts = [(float(i), float(i)) for i in range(1001)]

    out = service.downsample(pts, 500)

    assert len(out) == 500
    assert out[0] == pts[0] and out[-1] == pts[-1]
    assert service.downsample(pts[:10], 500) == pts[:10]


def test_about_mapping_builds_citation_with_doi() -> None:
    raw = {
        "title": "Flame Extinguishment Experiment",
        "investigationAcronym": "FLEX",
        "accession": "PSI-69",
        "doi": "10.60555/mbq8-0451",
        "licenseName": "CC0",
        "contacts": [
            {
                "firstName": "Forman",
                "lastName": "Williams",
                "affiliation": "UCSD",
                "roles": [{"annotationValue": "Principal Investigator (PI)"}],
            }
        ],
        "publications": [{"doi": "10.1/x"}, {"doi": ""}],
    }

    a = service.build_about(raw)

    assert "https://doi.org/10.60555/mbq8-0451" in a.citation
    assert a.contacts[0].name == "Forman Williams"
    assert (a.n_publications, a.n_publications_with_doi) == (2, 1)


needs_db = pytest.mark.skipif(not db_available(), reason="flame.duckdb is not built")

# Контрольні числа: docs/tasks/0001-home-overview-1b.md (вільні краплі).
EXPECTED = {
    "iss_air": [(21, 10, 3, 8)],
    "lunar": [(13, 0, 2, 11)],
    "co2_vs_he": [(99, 76, 3, 20), (41, 33, 4, 4)],
    "cool_flames": [(40, 34, 2, 4)],
    "clean_d2": [(161, 144, 17, 0)],
}


@needs_db
def test_overview_endpoint_matches_control_numbers() -> None:
    r = TestClient(app).get("/api/studies/flex/overview")

    assert r.status_code == 200
    body = r.json()
    assert body["facts"]["n_tests"] == 274
    assert (body["facts"]["first_year"], body["facts"]["last_year"]) == (2009, 2011)
    assert body["about"]["doi"] == "10.60555/mbq8-0451"
    got = {
        p["id"]: [
            (
                g["total"],
                g["by_end"]["extinction"],
                g["by_end"]["completion"],
                g["by_end"]["disruption"],
            )
            for g in p["groups"]
        ]
        for p in body["presets"]
    }
    for preset_id, expected in EXPECTED.items():
        assert got[preset_id] == expected, preset_id


@needs_db
def test_replay_endpoint_for_test_35_and_404() -> None:
    client = TestClient(app)

    r = client.get("/api/studies/flex/tests/35/replay")

    assert r.status_code == 200
    body = r.json()
    assert body["end_type"] == "Extinction"
    assert 0 < len(body["droplet"]) <= service.MAX_REPLAY_POINTS
    assert all(t >= 0 for t, _ in body["flame"])
    assert client.get("/api/studies/flex/tests/99999/replay").status_code == 404
