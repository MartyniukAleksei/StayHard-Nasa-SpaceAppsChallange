from pathlib import Path

import duckdb
import pytest
from fastapi.testclient import TestClient

from flame.core.config import settings
from flame.db.duckdb import get_cursor
from flame.main import app

TESTS = """
CREATE TABLE tests AS SELECT * FROM (VALUES
  (1, 'A1', DATE '2009-03-05', 'Heptane', 0.70, 0.30, 0.70, 0.0, 0.0, 'N2', 3.0, NULL, 0.9, 4.2,
   'Disruption', false, 300.0, true, true, true, true, true, 0, 'Sooty flame.'),
  (2, 'A2', DATE '2009-03-06', 'Heptane', 0.70, 0.21, 0.79, 0.0, 0.0, 'N2', 3.1, 1.0, 0.8, 6.0,
   'Extinction', false, 300.0, true, false, false, false, false, 1, 'Fiber-supported droplet.'),
  (3, 'A3', DATE '2009-03-07', 'Methanol', 1.00, 0.21, 0.79, 0.0, 0.0, 'N2', 2.0, 0.9, 0.5, 5.0,
   'Extinction', true, 300.0, false, false, false, false, false, 0, 'On a fiber.')
) t(test_no, cir_id, test_date, fuel, p_atm, x_o2, x_n2, x_co2, x_he, diluent, d0_mm, dext_mm,
    k_mm2_s, burn_time_s, end_type, ts_fiber, ts_temperature_k, has_droplet_ts,
    has_flame_color_ts, has_flame_uv_ts, has_chamber_ts, has_summary_pdf, n_videos, ts_comment)
"""


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db = tmp_path / "flame.duckdb"
    with duckdb.connect(str(db)) as con:
        con.execute(TESTS)
        for col in ("p_atm", "x_o2", "x_n2", "x_co2", "x_he", "d0_mm", "dext_mm", "k_mm2_s",
                    "burn_time_s", "ts_temperature_k"):  # fmt: skip
            con.execute(f"ALTER TABLE tests ALTER {col} TYPE DOUBLE")  # як у реальній БД
        con.execute(
            "CREATE TABLE ts_droplet AS SELECT 1::BIGINT AS test_no, (i * 0.1)::DOUBLE AS t_s, "
            "(3.0 - i * 0.01)::DOUBLE AS d_mm, 0.0::DOUBLE AS x_mm, 0.0::DOUBLE AS y_mm "
            "FROM range(100) r(i)"
        )
    flex = tmp_path / "flex"
    (flex / "raw" / "001").mkdir(parents=True)
    (flex / "raw" / "001" / "FLEX-001_DropletData.txt").write_text("t d\n")
    (flex / "secret.txt").write_text("no")
    monkeypatch.setitem(settings.__dict__, "flex_dir", flex)
    con = duckdb.connect(str(db), read_only=True)

    def cursor():
        cur = con.cursor()
        yield cur
        cur.close()

    app.dependency_overrides[get_cursor] = cursor
    yield TestClient(app)
    app.dependency_overrides.clear()
    con.close()


def test_query_tests_filters_sort_and_sources(client) -> None:
    r = client.get(
        "/api/studies/flex/tests",
        params={"f": ["fuel:eq:heptane", "p_atm:lt:0.75"], "sort": "x_o2", "desc": True},
    )
    body = r.json()
    assert r.status_code == 200
    assert body["total"] == 2
    assert [t["test_no"] for t in body["tests"]] == [1, 2]
    src = body["sources"][0]
    assert src["url"] == "/api/studies/flex/tests/1"
    assert "end type Disruption: self-extinction was not observed" in src["text"]
    assert "extinction diameter not recorded" in src["text"]


@pytest.mark.parametrize(
    "f", ["nope:eq:1", "p_atm:lt:abc", "fuel:gt:x", "fuel:eq:Kerosene", "p_atm"]
)
def test_query_tests_rejects_bad_filters(client, f) -> None:
    assert client.get("/api/studies/flex/tests", params={"f": f}).status_code == 422


def test_in_and_null_filters(client) -> None:
    body = client.get("/api/studies/flex/tests", params={"f": "dext_mm:is_null"}).json()
    assert [t["test_no"] for t in body["tests"]] == [1]
    body = client.get("/api/studies/flex/tests", params={"f": "test_no:in:2,3"}).json()
    assert body["total"] == 2


def test_test_detail_and_comment_source(client) -> None:
    body = client.get("/api/studies/flex/tests/1").json()
    assert body["test"]["fuel"] == "Heptane"
    assert body["files"][0]["url"] == "/api/media/flex/files/raw/001/FLEX-001_DropletData.txt"
    assert [s["text"] for s in body["sources"]][1] == "Sooty flame."
    assert client.get("/api/studies/flex/tests/99").status_code == 404


def test_timeseries_downsamples_and_keeps_last_point(client) -> None:
    body = client.get(
        "/api/studies/flex/tests/1/timeseries/droplet", params={"max_points": 10}
    ).json()
    assert body["n_total"] == 100
    assert len(body["rows"]) <= 11
    assert body["rows"][-1][0] == pytest.approx(9.9)
    assert [s["url"] for s in body["sources"]] == [
        "/api/studies/flex/tests/1/timeseries/droplet",
        "/api/media/flex/files/raw/001/FLEX-001_DropletData.txt",
    ]
    assert client.get("/api/studies/flex/tests/1/timeseries/bogus").status_code == 404


def test_neighbors_keep_fuel_and_fiber(client) -> None:
    body = client.get("/api/studies/flex/tests/2/neighbors").json()
    assert [n["test"]["test_no"] for n in body["neighbors"]] == [1]  # 3 — інше паливо й нитка


def test_compare_warns_on_fiber_mix_and_disruption(client) -> None:
    body = client.get("/api/studies/flex/compare", params={"ids": [1, 3]}).json()
    assert any("Fiber-supported" in w for w in body["warnings"])
    assert any("Disruption" in w for w in body["warnings"])
    p = next(f for f in body["fields"] if f["field"] == "p_atm")
    assert p["diff_vs_first"] == {"3": pytest.approx(0.3)}
    assert client.get("/api/studies/flex/compare", params={"ids": [1]}).status_code == 422


def test_media_serves_only_allowed_files(client) -> None:
    ok = client.get("/api/media/flex/files/raw/001/FLEX-001_DropletData.txt")
    assert ok.status_code == 200
    assert ok.headers["content-disposition"].startswith("inline")
    for bad in [
        "/api/media/flex/files/secret.txt",
        "/api/media/flex/files/raw/../secret.txt",
        "/api/media/flex/files/raw/%2e%2e/secret.txt",
        "/api/media/flex/files/../flex/raw/001/FLEX-001_DropletData.txt",
        "/api/media/flex/files/raw/001/missing.txt",
    ]:
        assert client.get(bad).status_code == 404, bad


def test_fiber_conflict_is_flagged_and_excluded_from_neighbors(client) -> None:
    body = client.get("/api/studies/flex/tests", params={"f": "test_no:in:1,2"}).json()
    assert [t["fiber_conflict"] for t in body["tests"]] == [False, True]
    assert "Data conflict" in body["sources"][1]["text"]
    assert client.get("/api/studies/flex/tests/1/neighbors").json()["neighbors"] == []
    warnings = client.get("/api/studies/flex/compare", params={"ids": [1, 2]}).json()["warnings"]
    assert any(w.startswith("FLEX-002: Data conflict") for w in warnings)
