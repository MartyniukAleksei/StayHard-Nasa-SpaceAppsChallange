"""Інші дослідження PSI: сервіс `studies.psi`, API /api/studies/{slug}, інструменти агента."""

from collections.abc import Iterator
from pathlib import Path

import duckdb
import pytest
from fastapi.testclient import TestClient

from flame.agent import tools
from flame.db.duckdb import get_cursor
from flame.main import app
from flame.studies.psi import service
from flame.studies.psi.repository import InvalidQuery
from flame.studies.psi.schemas import Filter


@pytest.fixture
def cur(tmp_path: Path) -> Iterator[duckdb.DuckDBPyConnection]:
    """Мініатюрна БД як після build_db: схеми cfi і samer, реєстр studies."""
    con = duckdb.connect(str(tmp_path / "flame.duckdb"))
    con.execute(
        """
        CREATE TABLE studies (slug VARCHAR, accession VARCHAR, acronym VARCHAR, title VARCHAR,
            doi VARCHAR, license VARCHAR, dataset VARCHAR, test_key VARCHAR, n_tests BIGINT,
            tables VARCHAR[]);
        INSERT INTO studies VALUES
            ('cfi', 'PSI-39', 'CFI', 'Cool Flames Investigation', '10.60555/m6pj-a914',
             'CC0-1.0', 'cfi-v1', 'test_no', 3, ['tests', 'test_files', 'ts_droplet']),
            ('samer', 'PSI-101', 'SAME-R', 'Smoke', '10.60555/2np7-jv14', 'CC0-1.0',
             'samer-v1', 'test_id', 2, ['tests', 'ts_sensors']);
        CREATE SCHEMA cfi;
        CREATE TABLE cfi.tests (test_no BIGINT, test_date DATE, fuel VARCHAR, p_atm DOUBLE,
            x_o2 DOUBLE, fiber BOOLEAN, k_hot_mm2_s DOUBLE);
        INSERT INTO cfi.tests VALUES
            (1206, '2017-01-10', 'dodecane', 1.0, 0.21, false, 0.5),
            (1207, '2017-01-11', 'dodecane', 3.0, 0.21, true, 0.7),
            (1300, '2017-05-02', 'farnesane', 1.0, 0.17, NULL, NULL);
        CREATE TABLE cfi.test_files (test_no VARCHAR, name VARCHAR, kind VARCHAR, bytes VARCHAR);
        INSERT INTO cfi.test_files VALUES ('1206', 'FLEX-1206_DropletData.txt', 'droplet_ts', '9');
        CREATE TABLE cfi.ts_droplet (test_no BIGINT, t_s DOUBLE, d_mm DOUBLE);
        INSERT INTO cfi.ts_droplet SELECT 1206, i * 0.1, 3.0 - i * 0.01 FROM range(100) t(i);
        CREATE SCHEMA samer;
        CREATE TABLE samer.tests (test_id VARCHAR, run_no BIGINT, aged_repeat BOOLEAN);
        INSERT INTO samer.tests VALUES ('52', 52, false), ('52a', 52, true);
        CREATE TABLE samer.ts_sensors (run_no INTEGER, t_s DOUBLE, ion_a_v DOUBLE);
        INSERT INTO samer.ts_sensors VALUES (52, 0, 1.5), (52, 1, 2.5);
        """
    )
    yield con.cursor()
    con.close()


def test_overview_profiles_columns_and_series(cur: duckdb.DuckDBPyConnection) -> None:
    o = service.overview(cur, "cfi")
    assert o.tables == {"test_files": 1, "tests": 3, "ts_droplet": 100}
    assert o.series == {"droplet": ["t_s", "d_mm"]}
    fuel = next(c for c in o.test_columns if c["column"] == "fuel")
    assert fuel["values"] == {"dodecane": 2, "farnesane": 1}
    assert o.sources[0].url == "https://doi.org/10.60555/m6pj-a914"
    assert "fiber" in o.sources[2].text  # примітки до даних


def test_query_filters_by_type_and_cites_each_row(cur: duckdb.DuckDBPyConnection) -> None:
    res = service.query_tests(
        cur,
        "cfi",
        [
            Filter(field="fuel", op="eq", value="DODECANE"),
            Filter(field="p_atm", op="lt", value="2"),
        ],
    )
    assert res.total == 1
    assert [t["test_no"] for t in res.tests] == [1206]
    assert res.sources[0].text.startswith("1 CFI tests match")
    assert res.sources[1].url == "/api/studies/cfi/tests/1206"
    assert "fiber = false" in res.sources[1].text
    dates = service.query_tests(
        cur, "cfi", [Filter(field="test_date", op="gte", value="2017-05-01")]
    )
    assert [t["test_no"] for t in dates.tests] == [1300]
    missing = service.query_tests(cur, "cfi", [Filter(field="fiber", op="is_null")])
    assert [t["test_no"] for t in missing.tests] == [1300]


@pytest.mark.parametrize(
    "flt",
    [
        Filter(field="nope", op="eq", value="1"),
        Filter(field="p_atm", op="gt", value="high"),
        Filter(field="p_atm", op="contains", value="1"),
        Filter(field="fiber", op="gt", value="true"),
        Filter(field="fuel", op="lt", value="x"),
    ],
)
def test_bad_filters_are_explained(cur: duckdb.DuckDBPyConnection, flt: Filter) -> None:
    with pytest.raises(InvalidQuery):
        service.query_tests(cur, "cfi", [flt])


def test_aggregate_groups_and_labels_computed_values(cur: duckdb.DuckDBPyConnection) -> None:
    res = service.aggregate(cur, "cfi", [], "fuel", "k_hot_mm2_s")
    assert [(g["grp"], g["n_tests"], g["n_values"]) for g in res.groups] == [
        ("dodecane", 2, 2),
        ("farnesane", 1, 0),
    ]
    assert res.sources[0].text.startswith("Computed from the CFI test table")
    assert "mean 0.6" in res.sources[0].text
    with pytest.raises(InvalidQuery):
        service.aggregate(cur, "cfi", [], None, "fuel")


def test_test_detail_and_series(cur: duckdb.DuckDBPyConnection) -> None:
    d = service.get_test(cur, "cfi", "1206")
    assert d.series == {"droplet": 100}
    assert "droplet_ts (1)" in d.sources[1].text
    ts = service.timeseries(cur, "cfi", "1206", "droplet", max_points=10)
    assert ts.n_points == 100 and len(ts.points) == 10
    assert "d_mm: 100 values, min 2.01, max 3" in ts.sources[0].text
    with pytest.raises(service.NotFound):
        service.timeseries(cur, "cfi", "1207", "droplet")
    with pytest.raises(service.NotFound):
        service.get_test(cur, "cfi", "abc")


def test_samer_series_is_per_run(cur: duckdb.DuckDBPyConnection) -> None:
    ts = service.timeseries(cur, "samer", "52a", "sensors")
    assert ts.n_points == 2
    assert "run 52, shared by all tests of this run" in ts.sources[0].text


def test_unknown_or_unloaded_study(cur: duckdb.DuckDBPyConnection) -> None:
    for slug in ("flex", "cfig", "nope"):
        with pytest.raises(service.NotFound):
            service.overview(cur, slug)


def test_endpoints(cur: duckdb.DuckDBPyConnection) -> None:
    app.dependency_overrides[get_cursor] = lambda: cur
    try:
        c = TestClient(app)
        assert c.get("/api/studies/cfi").json()["tables"]["tests"] == 3
        r = c.get("/api/studies/cfi/tests", params={"f": ["fuel:eq:dodecane"], "columns": "p_atm"})
        assert r.json()["total"] == 2 and set(r.json()["tests"][0]) == {"test_no", "p_atm", "fuel"}
        r = c.get("/api/studies/cfi/aggregate", params={"group_by": "fuel"})
        assert r.json()["groups"][0]["n_tests"] == 2
        assert c.get("/api/studies/cfi/tests/1206").json()["test"]["fuel"] == "dodecane"
        r = c.get("/api/studies/cfi/tests/1206/timeseries/droplet", params={"max_points": 5})
        assert len(r.json()["points"]) == 5
        assert c.get("/api/studies/cfi/tests", params={"f": ["p_atm:gt:x"]}).status_code == 422
        assert c.get("/api/studies/cfi/tests/9999").status_code == 404
        assert c.get("/api/studies/cfig").status_code == 404  # знімка немає в цій БД
    finally:
        app.dependency_overrides.clear()


def test_agent_tools(cur: duckdb.DuckDBPyConnection) -> None:
    out = tools.HANDLERS["describe_study"](cur, {"study": "cfi"})
    assert out.content()[0]["type"] == "search_result"
    out = tools.HANDLERS["query_study_tests"](
        cur,
        {"study": "cfi", "filters": [{"field": "fiber", "op": "eq", "value": "true"}],
         "columns": [], "sort": "", "descending": False, "limit": 5},
    )  # fmt: skip
    assert [s.url for s in out.sources] == [
        "/api/studies/cfi/tests?f=fiber:eq:true",
        "/api/studies/cfi/tests/1207",
    ]
    out = tools.HANDLERS["aggregate_study_tests"](
        cur, {"study": "cfi", "filters": [], "group_by": "fuel", "metric": ""}
    )
    assert "dodecane: 2 tests" in out.sources[0].text
    out = tools.HANDLERS["get_study_timeseries_summary"](
        cur, {"study": "samer", "test_id": "52", "series": "ts_sensors"}
    )
    assert "2 rows" in out.sources[0].text
    with pytest.raises(tools.ToolError, match="unknown column"):
        tools.HANDLERS["query_study_tests"](
            cur, {"study": "cfi", "filters": [{"field": "x", "op": "eq", "value": "1"}]}
        )
    names = {t["name"] for t in tools.TOOLS}
    assert {"describe_study", "get_study_test"} <= names and names == set(tools.HANDLERS)
    assert tools.status_text("get_study_test", {"study": "saffire2", "test_id": "2-5"}) == (
        "Reading Saffire-II test 2-5…"
    )
