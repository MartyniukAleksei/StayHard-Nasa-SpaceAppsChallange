"""Кадри з PSI: фейковий zip замість S3 (підміняємо psi.fetch_range) і тимчасова БД."""

import io
import zipfile
from collections.abc import Iterator

import duckdb
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from flame.db.duckdb import get_cursor
from flame.main import app
from flame.media import psi, service

ZIP_NAME = "PSI-69_Raw Data_C09H101B.zip"
INDEX = """Reference Time Stamp 6/29/2010 8:25:59.691853
Milliseconds 8405839
ImgNum, DiskNum, FileNum, FileIndex, Mseconds, Delta,       Date,      MTimeStamp,       FileName
     0,       0,       0,         0,  8686685,    34, 06/29/2010, 08:30:39.941852, C09H101B_00000
     1,       1,       0,         0,  8686719,    33, 06/29/2010, 08:30:39.975186, C09H101B_00001
"""


def _tiff16(value: int) -> bytes:
    img = Image.new("I;16", (8, 8), value)
    buf = io.BytesIO()
    img.save(buf, "TIFF")
    return buf.getvalue()


def _zip_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("C09H101B.txt", INDEX)
        z.writestr("C09H101B_00000.tif", _tiff16(0))
        z.writestr("C09H101B_00001.tif", _tiff16(4095))  # верх вікна камери B → білий
    return buf.getvalue()


@pytest.fixture
def client(tmp_path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    blob = _zip_bytes()
    calls: list[tuple[int, int]] = []

    def fake_fetch_range(name: str, version: str, start: int, end: int) -> bytes:
        assert name == ZIP_NAME
        calls.append((start, end))
        return blob[start:end]

    monkeypatch.setattr(psi, "fetch_range", fake_fetch_range)
    for cached in (psi.open_zip, service._frame_index, service._render):
        cached.cache_clear()

    con = duckdb.connect(str(tmp_path / "t.duckdb"))
    con.execute("CREATE TABLE tests AS SELECT 100::BIGINT AS test_no")
    con.execute(
        "CREATE TABLE test_files AS SELECT '100' AS test_no, 'camera_images_zip' AS kind, "
        f"'B' AS camera, '{ZIP_NAME}' AS name, '1' AS version, '{len(blob)}' AS bytes"
    )

    def cursor() -> Iterator[duckdb.DuckDBPyConnection]:
        yield con.cursor()

    app.dependency_overrides[get_cursor] = cursor
    c = TestClient(app)
    c.range_calls = calls  # type: ignore[attr-defined]
    yield c
    app.dependency_overrides.clear()
    con.close()


def test_cameras_come_from_db(client: TestClient) -> None:
    r = client.get("/api/media/flex/100/cameras")
    assert r.status_code == 200
    (cam,) = r.json()["cameras"]
    assert cam["camera"] == "B" and cam["label"] == "LLL-UV" and cam["psi_file"] == ZIP_NAME
    assert client.range_calls == []  # type: ignore[attr-defined]  # PSI не чіпаємо


def test_frame_index_from_embedded_txt(client: TestClient) -> None:
    r = client.get("/api/media/flex/100/cameras/b/frames")
    assert r.status_code == 200
    j = r.json()
    assert j["n_frames"] == 2
    assert j["t_ms"] == [0, 34]
    assert j["start_time"] == "2010-06-29T08:30:39.941852"
    assert "immutable" in r.headers["cache-control"]


def test_frame_is_jpeg_scaled_by_camera_window(client: TestClient) -> None:
    r = client.get("/api/media/flex/100/cameras/B/frames/1.jpg")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    img = Image.open(io.BytesIO(r.content))
    assert img.mode == "L" and img.getextrema()[0] > 250

    n = len(client.range_calls)  # type: ignore[attr-defined]
    client.get("/api/media/flex/100/cameras/B/frames/1.jpg")
    assert len(client.range_calls) == n  # type: ignore[attr-defined]  # другий раз із кешу


def test_not_found(client: TestClient) -> None:
    assert client.get("/api/media/flex/999/cameras").status_code == 404
    assert client.get("/api/media/flex/100/cameras/A/frames").status_code == 404
    assert client.get("/api/media/flex/100/cameras/B/frames/2.jpg").status_code == 404


def test_psi_failure_is_502(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def down(*_: object) -> bytes:
        raise psi.PsiUnavailable("down")

    monkeypatch.setattr(psi, "fetch_range", down)
    assert client.get("/api/media/flex/100/cameras/B/frames").status_code == 502
