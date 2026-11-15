"""Saffire-II: розбір полів таблиці PSI і ендпоінти сторінки дашбордів."""

import pytest

from flame.db.duckdb import db_available
from flame.studies.saffire2.service import burn_length_cm, spread, verdict

needs_db = pytest.mark.skipif(not db_available(), reason="flame.duckdb is not built")


@pytest.mark.parametrize(
    ("raw", "cm"),
    [
        ("Complete", 29.0),
        ("~ 0", 0.0),
        ("~ 0 (Nomex)", 0.0),
        ("29 cm", 29.0),
        ("7.6 cm", 7.6),
        ("~ 10 cm (note 3)", 10.0),
        ("5 cm & 0 (note 2)", 5.0),
        ("n/a", None),
        ("", None),
    ],
)
def test_burn_length_parses_table_text(raw: str, cm: float | None) -> None:
    assert burn_length_cm(raw) == cm


def test_spread_parses_numbers_ranges_and_words() -> None:
    assert spread("2.1 mm/s").lo == 2.1
    assert spread("Acceleratory").accelerating
    note4 = spread("Note 4")
    assert (note4.lo, note4.hi, note4.note) == (0.01, 0.04, "Note 4")
    assert spread("n/a (Nomex)").lo is None


def test_verdict() -> None:
    assert verdict("Silicone", 0, 29) == "earth_stricter"
    assert verdict("SIBAL", 29, 29) == "match"
    assert verdict("X", 29, 7.6) == "earth_weaker"
    assert verdict("PMMA & Nomex", 5, 0) == "not_comparable"
    assert verdict("Silicone", None, 0) == "unknown"


@needs_db
def test_dashboard_and_series_endpoints() -> None:
    from fastapi.testclient import TestClient

    from flame.main import app

    client = TestClient(app)
    r = client.get("/api/studies/saffire2/dashboard")
    if r.status_code == 503:
        pytest.skip("saffire2 tables are not in the database")
    assert r.status_code == 200
    d = r.json()
    assert [s["test_id"] for s in d["samples"]] == [f"2-{i}" for i in range(1, 10)]
    assert d["about"]["doi"] == "10.60555/2chp-m469"

    s = client.get("/api/studies/saffire2/samples/2-5/series").json()
    assert len(s["sample_tc"]) == 6 and len(s["t"]) == len(s["co2_pct"])
    assert s["t"][0] < 0  # the recording starts before ignition

    assert client.get("/api/studies/saffire2/samples/2-0/series").status_code == 404
    assert client.get("/api/studies/saffire2/samples/x/series").status_code == 422
