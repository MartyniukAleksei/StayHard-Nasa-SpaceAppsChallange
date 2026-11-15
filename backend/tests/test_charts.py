from pathlib import Path

import duckdb
import pytest

from flame.studies.flex import charts
from flame.studies.flex.schemas import Filter
from tests.test_flex_api import TESTS


@pytest.fixture
def cur(tmp_path: Path):
    db = tmp_path / "flame.duckdb"
    with duckdb.connect(str(db)) as con:
        con.execute(TESTS)
        for col in ("p_atm", "x_o2", "x_n2", "x_co2", "x_he", "d0_mm", "dext_mm", "k_mm2_s",
                    "burn_time_s", "ts_temperature_k"):  # fmt: skip
            con.execute(f"ALTER TABLE tests ALTER {col} TYPE DOUBLE")
        con.execute(
            "CREATE TABLE ts_droplet AS SELECT 1::BIGINT AS test_no, "
            "(i * 0.1 - 0.5)::DOUBLE AS t_s, "
            "(3.0 - i * 0.01)::DOUBLE AS d_mm, 0.0::DOUBLE AS x_mm, 0.0::DOUBLE AS y_mm "
            "FROM range(1000) r(i)"
        )
    con = duckdb.connect(str(db), read_only=True)
    yield con.cursor()
    con.close()


def test_d2_line_is_derived_thinned_and_starts_at_ignition(cur) -> None:
    out = charts.line(cur, "droplet_d2", [1])
    chart = out["chart"]
    [s] = chart["series"]
    assert chart["derived"] is True and chart["y_label"] == "d², mm²"
    assert len(s["points"]) <= charts.POINTS_PER_SERIES + 1
    assert s["points"][0][0] >= 0  # t < 0 (до запалювання) відкинуто
    assert s["points"][0][1] == pytest.approx(2.95**2, rel=1e-3)
    assert out["sources"][0].url == "/api/studies/flex/tests/1/timeseries/droplet"
    assert "derived" in out["sources"][0].text


def test_normalized_needs_d0_and_missing_series_is_reported(cur) -> None:
    out = charts.line(cur, "droplet_d2_normalized", [1, 2])
    assert [s["id"] for s in out["chart"]["series"]] == ["FLEX-001"]
    assert out["chart"]["notes"] == ["FLEX-002: no droplet series"]
    assert out["chart"]["x_label"].startswith("t / d₀²")
    first = out["chart"]["series"][0]["points"][0]
    assert first[1] == pytest.approx((2.95 / 3.0) ** 2, rel=1e-3)


@pytest.mark.parametrize(
    "quantity, nos, error",
    [("nope", [1], "unknown quantity"), ("droplet_d2", [1, 2, 3, 4], "1-3 tests"),
     ("droplet_d2", [99], "not found")],
)  # fmt: skip
def test_line_validation(cur, quantity, nos, error) -> None:
    with pytest.raises(charts.ChartError, match=error):
        charts.line(cur, quantity, nos)


def test_scatter_groups_by_end_type(cur) -> None:
    out = charts.scatter(cur, [Filter(field="fuel", op="eq", value="Heptane")], "x_o2", "k_mm2_s")
    groups = {s["id"]: s for s in out["chart"]["series"]}
    assert set(groups) == {"Disruption", "Extinction"}
    assert groups["Disruption"]["tone"] == "dis" and groups["Disruption"]["test_nos"] == [1]
    assert out["sources"][0].url == "/api/studies/flex/tests?f=fuel:eq:Heptane"
    with pytest.raises(charts.ChartError, match="not a numeric field"):
        charts.scatter(cur, [], "fuel", "k_mm2_s")
