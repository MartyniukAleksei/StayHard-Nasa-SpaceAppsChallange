import json
import zipfile
from pathlib import Path

import duckdb
import pytest

from flame.core.config import settings
from flame.ingest import bootstrap, build_db


def _make_archive(tmp: Path, dataset: str) -> str:
    """zip з мінімальним знімком flex/ (manifest + flex.duckdb), як у релізі."""
    src = tmp / f"src-{dataset}" / "flex"
    src.mkdir(parents=True)
    (src / "manifest.json").write_text(json.dumps({"dataset": dataset}))
    with duckdb.connect(str(src / "flex.duckdb")) as con:
        con.execute("CREATE TABLE tests AS SELECT 1 AS test_no")
    archive = tmp / f"{dataset}.zip"
    with zipfile.ZipFile(archive, "w") as z:
        for p in src.rglob("*"):
            z.write(p, p.relative_to(src.parent))
    return archive.as_uri()


@pytest.fixture
def data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    data = tmp_path / "data"
    monkeypatch.setattr(settings, "data_dir", data)
    monkeypatch.setitem(settings.__dict__, "flex_dir", data / "flex")
    monkeypatch.setitem(settings.__dict__, "duckdb_path", data / "build" / "flame.duckdb")
    return data


def test_bootstrap_downloads_builds_and_is_idempotent(
    data_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "data_archive_url", _make_archive(tmp_path, "flex-v1"))
    bootstrap.main()
    meta = build_db.read_meta(settings.duckdb_path)
    assert meta["build_version"] == build_db.BUILD_VERSION
    assert meta["dataset"] == "flex-v1"

    built_at = meta["built_at"]
    bootstrap.main()  # нічого не змінилось — без перезбірки
    assert build_db.read_meta(settings.duckdb_path)["built_at"] == built_at


def test_bootstrap_rebuilds_on_new_code_version(
    data_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "data_archive_url", _make_archive(tmp_path, "flex-v1"))
    bootstrap.main()
    monkeypatch.setattr(build_db, "BUILD_VERSION", "changed")
    bootstrap.main()
    assert build_db.read_meta(settings.duckdb_path)["build_version"] == "changed"


def test_bootstrap_replaces_snapshot_on_new_release(
    data_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "data_archive_url", _make_archive(tmp_path, "flex-v1"))
    bootstrap.main()
    monkeypatch.setattr(settings, "data_archive_url", _make_archive(tmp_path, "flex-v2"))
    bootstrap.main()
    assert build_db.read_meta(settings.duckdb_path)["dataset"] == "flex-v2"
