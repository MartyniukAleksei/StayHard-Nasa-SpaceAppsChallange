"""SAME-R API над схемою `samer` у тимчасовій flame.duckdb (як її збирає psi_studies)."""

import io
import json
import zipfile
from collections.abc import Iterator
from pathlib import Path

import duckdb
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from flame.core.config import settings
from flame.db.duckdb import get_connection
from flame.main import app
from flame.media import psi
from flame.studies.same_r import repository, service

TEM_ZIP = "PSI-101_Raw Data_#73 preage 26K Kapton.zip"
HKP_FILE = "PSI-101_Raw Data_HKPData_gmt238_1.csv"
PPTX = "PSI-101_Raw Data_73 postage Kapton 26K.pptx"


def _tem_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, value in (("73 pre 26K_1 340x.tif", 1000), ("73 pre 26K_2 1350x.tif", 40000)):
            tif = io.BytesIO()
            Image.new("I;16", (8, 8), value).save(tif, "TIFF")
            z.writestr(f"Run 073/{name}", tif.getvalue())
        z.writestr("Run 073/notes.txt", "x")
    return buf.getvalue()


def _build(data: Path, tem_bytes: int, with_samer: bool = True) -> Path:
    db = data / "build" / "flame.duckdb"
    db.parent.mkdir(parents=True)
    con = duckdb.connect(str(db))
    con.execute("CREATE TABLE study_about (study VARCHAR, about VARCHAR)")
    about = {"doi": "10.60555/2np7-jv14", "title": "Smoke Aerosol Measurement Experiment-Reflight"}
    con.execute("INSERT INTO study_about VALUES ('samer', ?)", [json.dumps(about)])
    if with_samer:
        con.execute("CREATE SCHEMA samer")
        # типи колонок як у знімку (DOUBLE, не DECIMAL з літералів)
        con.execute("""
            CREATE TABLE samer.tests (test_id VARCHAR, run_no BIGINT, aged_repeat BOOLEAN,
              sample_type VARCHAR, description VARCHAR, test_date DATE, inlet_velocity_cm_s DOUBLE,
              rt_r0 DOUBLE, duration_s DOUBLE, primary_aging_s DOUBLE, primary_mixing_s DOUBLE,
              net_aging_s DOUBLE, has_sensors_ts BOOLEAN)
        """)
        con.execute("""
            INSERT INTO samer.tests VALUES
              ('73', 73, false, 'Kapton', 'Baseline Aging', '2010-08-26',
               8.1, 1.38, 60, 11, 8, 33, true),
              ('73a', 73, true, 'Kapton', 'aged', '2010-08-26',
               8.1, 1.38, NULL, NULL, NULL, 560, true),
              ('51', 51, false, 'Kapton', 'B.L. new formula', '2010-07-21',
               8.1, 1.38, 60, 11, 8, 38, false)
        """)
        con.execute(f"""
            CREATE TABLE samer.test_files AS SELECT * FROM (VALUES
              ('73', 'run_name', 'Raw Data', 'archive_zip', '{TEM_ZIP}', '{tem_bytes}', '1'),
              ('73', 'run_folder', 'Raw Data', 'hkp_csv', '{HKP_FILE}', '3', '1'),
              ('73', 'run_folder', 'Raw Data', 'other_pptx', '{PPTX}', '99', '1'),
              (NULL, NULL, 'Engineering Documents', 'archive_zip',
               'PSI-101_Engineering Documents_SAME-R Flight Ops photos.zip', '10', '1')
            ) t(test_id, match, category, kind, name, bytes, version)
        """)
        # t_s від початку файлу; нагрівач з t_s = 1; -999 і 10010 — службові коди приладів
        cols = (
            "t_s, heating, sample_resistance_ohm, plume_t_c, ptrak_pt_cc, dusttrak_a_mg_m3,"
            " dusttrak_b_mg_m3, iss_obscuration_v, iss_scatter_v, sts_v, ion_a_v, ion_b_v"
        )
        typed = ", ".join(f"{c.strip()} DOUBLE" for c in cols.split(","))
        con.execute(f"CREATE TABLE samer.ts_sensors (run_no INTEGER, {typed})")
        con.execute("""
            INSERT INTO samer.ts_sensors VALUES
              (73, 0, 0, 0.63, 25.5, -999, 10010, 0, 3.43, -0.18, 0, 0.03, 4.8),
              (73, 1, 1, 0.64, 25.6, 0, 0.2, 0, 3.43, -0.18, 0, 0.03, 4.8),
              (73, 2, 1, 0.80, 41.0, 10, 0.3, 0.1, 3.43, -0.19, 0, 0.03, 4.9),
              (73, 3, 0, 0.85, 60.0, 500, 0.4, 0.5, 3.43, -0.25, 0, 0.04, 5.0)
        """)
    con.close()
    return db


@pytest.fixture
def data(tmp_path: Path) -> Path:
    samer = tmp_path / "samer"
    (samer / "raw" / "73").mkdir(parents=True)
    (samer / "raw" / "73" / "HKPData_gmt238_1.csv").write_text("t,v\n")
    reports = samer / "docs" / "Reports"
    reports.mkdir(parents=True)
    (reports / "Reports_SAME-R_Final Report.pdf").write_bytes(b"%PDF")
    photos = samer / "docs" / "Engineering Documents"
    photos.mkdir(parents=True)
    with zipfile.ZipFile(photos / repository.PHOTOS_ZIP, "w") as z:
        for n in ("ISS015E27397.jpe", "iss024e008350.jpg", "Thumbs.db"):
            jpg = io.BytesIO()
            Image.new("RGB", (40, 20), (200, 10, 10)).save(jpg, "JPEG")
            z.writestr(f"SAME-R Flight Ops photos/{n}", jpg.getvalue())
    return tmp_path


def _client(data: Path, monkeypatch: pytest.MonkeyPatch, **build) -> Iterator[TestClient]:
    blob = _tem_zip()
    db = _build(data, len(blob), **build)
    monkeypatch.setattr(settings, "data_dir", data)
    monkeypatch.setitem(settings.__dict__, "duckdb_path", db)
    monkeypatch.setattr(psi, "fetch_range", lambda name, version, s, e: blob[s:e])
    for cached in (get_connection, psi.open_zip, service._render, service._shrink):
        cached.cache_clear()
    yield TestClient(app)
    get_connection.cache_clear()


@pytest.fixture
def client(data: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    yield from _client(data, monkeypatch)


def test_tests_table(client: TestClient):
    tests = client.get("/api/studies/same-r/tests").json()["tests"]
    by_id = {t["test_id"]: t for t in tests}
    assert set(by_id) == {"73", "73a", "51"}
    assert by_id["73"]["material"] == "Kapton" and by_id["73"]["date_2010"] == "26-Aug"
    assert by_id["73a"]["heating_s"] is None
    assert by_id["51"]["has_timeseries"] is False
    assert by_id["73"]["ptrak_peak_per_cc"] == 500.0  # -999 — не показ, а «не міряє»
    assert by_id["73"]["active_detectors"] == ["ion_b_v"]  # змінився ≥ 0.1 В
    assert by_id["73"]["has_tem"] is True and by_id["51"]["has_tem"] is False
    assert by_id["51"]["ptrak_peak_per_cc"] is None


def test_test_detail(client: TestClient):
    body = client.get("/api/studies/same-r/tests/73").json()
    assert [r["test_id"] for r in body["rows"]] == ["73", "73a"]
    cov = body["coverage"]
    got = (cov["t_min"], cov["t_max"], cov["heating_s"], cov["ptrak_peak_t_s"])
    assert got == (-1.0, 2.0, 2, 2.0)
    assert body["tem_archives"][0] | {"bytes": 0} == {
        "test": 73,
        "name": TEM_ZIP,
        "version": "1",
        "bytes": 0,
        "sample_id": "26K",
        "aging": "pre",
    }
    files = {f["name"]: f for f in body["files"]}
    assert files[HKP_FILE]["local"]
    assert files[HKP_FILE]["url"].startswith("/api/media/samer/files/raw/73/")
    assert not files[PPTX]["local"] and files[PPTX]["url"].startswith("/api/studies/same-r/psi/")
    assert TEM_ZIP not in files
    urls = [s["url"] for s in body["sources"]]
    assert "/api/studies/samer/tests/73" in urls and "https://doi.org/10.60555/2np7-jv14" in urls
    r = client.get(files[HKP_FILE]["url"])
    assert r.status_code == 200 and r.text == "t,v\n"
    assert client.get("/api/studies/same-r/tests/999").status_code == 404


def test_timeseries_shifted_to_heater_on_and_codes_dropped(client: TestClient):
    body = client.get("/api/studies/same-r/tests/73/timeseries/hkp").json()
    assert body["columns"][0] == "t_s" and len(body["columns"]) == 12
    assert [r[0] for r in body["rows"]] == [-1.0, 0.0, 1.0, 2.0]  # 0 = перший рядок з heating = 1
    first = dict(zip(body["columns"], body["rows"][0], strict=True))
    assert first["ptrak_per_cc"] is None and first["dusttrak_a_mg_m3"] is None
    assert client.get("/api/studies/same-r/tests/51/timeseries/hkp").status_code == 404
    assert client.get("/api/studies/same-r/tests/73/timeseries/nope").status_code == 404


def test_overview_documents(client: TestClient):
    body = client.get("/api/studies/same-r/overview").json()
    assert body["doi"] == "10.60555/2np7-jv14"
    reports = [g for g in body["documents"] if g["category"] == "Reports"][0]["files"]
    assert reports[0]["title"] == "SAME-R_Final Report" and reports[0]["local"]
    assert all(not f["name"].endswith(".zip") for g in body["documents"] for f in g["files"])


def test_psi_redirect_only_known_files(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(psi, "signed_url", lambda name, version: f"https://s3/{name}?v={version}")
    r = client.get(f"/api/studies/same-r/psi/{PPTX}", follow_redirects=False)
    assert r.status_code == 307 and r.headers["location"].endswith("Kapton%2026K.pptx?v=1")
    assert client.get("/api/studies/same-r/psi/evil.zip", follow_redirects=False).status_code == 404


def test_tem_images_one_psi_read_per_image(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    calls: list[int] = []
    blob = _tem_zip()

    def fake(name: str, version: str, s: int, e: int) -> bytes:
        calls.append(s)
        return blob[s:e]

    monkeypatch.setattr(psi, "fetch_range", fake)
    images = client.get("/api/studies/same-r/tests/73/tem").json()["archives"][0]["images"]
    assert [i["name"] for i in images] == ["73 pre 26K_1 340x.tif", "73 pre 26K_2 1350x.tif"]
    r = client.get(images[1]["url"])
    assert r.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(r.content)).getpixel((4, 4)) > 100  # 16 біт → 8 біт, не чорне
    n = len(calls)
    assert client.get(images[1]["url"] + "?max_side=64").status_code == 200
    assert len(calls) == n  # мініатюра з кешу, без нового читання з PSI
    assert client.get("/api/studies/same-r/tests/73/tem/0/5.jpg").status_code == 404
    assert client.get("/api/studies/same-r/tests/999/tem").status_code == 404


def test_photos_from_local_zip_only_same_r_flight(client: TestClient):
    service._render_photo.cache_clear()
    body = client.get("/api/studies/same-r/photos").json()
    assert [i["name"] for i in body["images"]] == ["iss024e008350.jpg"]  # SAME 2007 і сміття — ні
    r = client.get(body["images"][0]["url"] + "?max_side=64")
    assert r.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(r.content)).size == (40, 20)
    assert client.get("/api/studies/same-r/photos/1.jpg").status_code == 404


def test_503_without_samer_schema(data: Path, monkeypatch: pytest.MonkeyPatch):
    for c in _client(data, monkeypatch, with_samer=False):
        r = c.get("/api/studies/same-r/tests")
        assert r.status_code == 503 and "data-psi-studies" in r.json()["detail"]
