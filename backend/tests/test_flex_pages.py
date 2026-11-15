"""Ендпоінти сторінок FLEX (дослідник, тест, бібліотека), media і каталог досліджень."""

import pytest
from fastapi.testclient import TestClient

from flame.db.duckdb import db_available
from flame.main import app
from flame.media import files as media

client = TestClient(app)
needs_db = pytest.mark.skipif(not db_available(), reason="flame.duckdb is not built")


@pytest.mark.parametrize(
    "rel_path",
    [
        "../about.json",
        "raw/../../about.json",
        "about.json",
        "/etc/passwd",
        "",
        "raw/../manifest.json",
    ],
)
def test_media_rejects_paths_outside_allowed_roots(rel_path: str) -> None:
    assert media.resolve("flex", rel_path) is None


def test_media_describes_known_file_kinds() -> None:
    assert media.describe("FLEX-035_Summary.pdf") == "Summary report (PDF)"
    assert media.describe("MDCA Movie View.mp4") == "Video"
    assert media.describe("181F001_HIBMS_Camera_Settings.txt").startswith("Instrument")


def test_studies_catalog_has_active_studies_first() -> None:
    r = client.get("/api/studies")

    assert r.status_code == 200
    cards = r.json()
    assert cards[0]["acronym"] == "FLEX" and cards[0]["status"] == "active"
    assert cards[0]["route"] == "/studies/flex"
    assert cards[1]["acronym"] == "SAME-R" and cards[1]["route"] == "/studies/same-r"
    assert cards[1]["facts"] is None  # факти з БД лише у FLEX
    assert all(c["status"] == "coming_soon" and c["route"] is None for c in cards[2:])
    assert all(c["doi"] for c in cards)


@needs_db
def test_tests_list_has_all_rows_and_flags() -> None:
    rows = client.get("/api/studies/flex/explorer").json()

    assert len(rows) == 274
    t35 = next(t for t in rows if t["test_no"] == 35)
    assert t35["cool_flame"] is True and t35["fiber"] is False and t35["has_series"] is True


@needs_db
def test_neighbors_share_fuel_diluent_and_fiber_class() -> None:
    me = client.get("/api/studies/flex/tests/35/report").json()
    rows = {t["test_no"]: t for t in client.get("/api/studies/flex/explorer").json()}

    assert 0 < len(me["neighbors"]) <= 5
    for n in me["neighbors"]:
        other = rows[n["test_no"]]
        assert n["test_no"] != 35
        assert (other["fuel"], other["diluent"], other["fiber"]) == (
            me["fuel"],
            me["diluent"],
            me["fiber"],
        )
    distances = [n["distance"] for n in me["neighbors"]]
    assert distances == sorted(distances)


@needs_db
def test_test_detail_lists_local_files_and_404() -> None:
    me = client.get("/api/studies/flex/tests/35/report").json()

    assert me["test_date"] == "2009-11-27"
    assert any(f["name"].endswith("_Summary.pdf") for f in me["files"])
    assert client.get("/api/studies/flex/tests/99999/report").status_code == 404


@needs_db
def test_series_csv_has_header_with_doi() -> None:
    r = client.get("/api/studies/flex/tests/35/series.csv")

    assert r.status_code == 200
    lines = r.text.splitlines()
    assert "10.60555/mbq8-0451" in lines[0]
    assert lines[1] == "signal,t_s,value"


@needs_db
def test_library_limitations_match_control_numbers() -> None:
    lib = client.get("/api/studies/flex/library").json()

    lim = lib["limitations"]
    assert (lim["fiber"], lim["free"], lim["fiber_unknown"]) == (54, 212, 8)
    assert (lim["disruption"], lim["missing_d0"], lim["missing_k"]) == (61, 12, 16)
    assert len(lib["publications"]) == 51
    assert lib["documents"]


@needs_db
def test_media_serves_pdf_and_video_range() -> None:
    assert client.get("/api/media/flex/files/raw/035/FLEX-035_Summary.pdf").status_code == 200
    videos = [t for t in client.get("/api/studies/flex/explorer").json() if t["has_video"]]
    if not videos:
        pytest.skip("no local videos")
    v = client.get(f"/api/studies/flex/tests/{videos[0]['test_no']}/report").json()["videos"][0]
    r = client.get(f"/api/media/flex/files/{v['path']}", headers={"Range": "bytes=0-99"})
    assert r.status_code == 206 and len(r.content) == 100


@needs_db
def test_has_3d_follows_droplet_series() -> None:
    rows = client.get("/api/studies/flex/explorer").json()
    assert sum(t["has_3d"] for t in rows) == 254
    no_3d = next(t for t in rows if not t["has_3d"])
    detail = client.get(f"/api/studies/flex/tests/{no_3d['test_no']}/report").json()
    assert detail["has_3d"] is False
    assert client.get("/api/studies/flex/tests/35/report").json()["has_3d"] is True


@needs_db
def test_videos_list_mp4_with_test_conditions() -> None:
    videos = client.get("/api/studies/flex/videos").json()
    with_video = {
        t["test_no"] for t in client.get("/api/studies/flex/explorer").json() if t["has_video"]
    }
    if not with_video:
        pytest.skip("no local videos")
    assert {v["test_no"] for v in videos} == with_video
    v = videos[0]
    assert v["path"].endswith(".mp4") and v["fuel"] and v["end_type"]
    r = client.get(f"/api/media/flex/files/{v['path']}", headers={"Range": "bytes=0-9"})
    assert r.status_code == 206
