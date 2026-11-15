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


def _make_studies_archive(tmp: Path, dataset: str) -> str:
    """zip як psi-studies-vN: каталог cfi/ з cfi.duckdb і manifest + README.md у корені."""
    root = tmp / f"src-{dataset}"
    cfi = root / "cfi"
    cfi.mkdir(parents=True)
    (cfi / "manifest.json").write_text(json.dumps({"dataset": dataset}))
    with duckdb.connect(str(cfi / "cfi.duckdb")) as con:
        con.execute("CREATE TABLE tests AS SELECT 1206 AS test_no")
    (root / "README.md").write_text("readme")
    archive = tmp / f"{dataset}.zip"
    with zipfile.ZipFile(archive, "w") as z:
        for p in root.rglob("*"):
            z.write(p, p.relative_to(root))
    return archive.as_uri()


@pytest.fixture
def installs(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Записує, які URL bootstrap справді качав."""
    calls: list[str] = []
    real = bootstrap._install

    def spy(url: str, data: Path) -> list[str]:
        calls.append(url)
        return real(url, data)

    monkeypatch.setattr(bootstrap, "_install", spy)
    return calls


def test_bootstrap_installs_several_archives_and_updates_one(
    data_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, installs: list[str]
) -> None:
    flex, studies = _make_archive(tmp_path, "flex-v1"), _make_studies_archive(tmp_path, "cfi-v1")
    monkeypatch.setattr(settings, "data_archive_urls", [flex, studies])
    bootstrap.main()
    assert installs == [flex, studies]
    assert json.loads(build_db.read_meta(settings.duckdb_path)["datasets"]) == {
        "flex": "flex-v1",
        "cfi": "cfi-v1",
    }
    assert json.loads((data_dir / bootstrap.STATE).read_text()) == {
        flex: ["flex"],
        studies: ["cfi"],
    }

    (data_dir / "flex" / "local.txt").write_text("kept")
    bootstrap.main()  # нічого не змінилось
    assert installs == [flex, studies]

    studies_v2 = _make_studies_archive(tmp_path, "cfi-v2")
    monkeypatch.setattr(settings, "data_archive_urls", [flex, studies_v2])
    bootstrap.main()
    assert installs == [flex, studies, studies_v2]  # FLEX не перекачувався
    assert (data_dir / "flex" / "local.txt").exists()
    assert json.loads(build_db.read_meta(settings.duckdb_path)["datasets"])["cfi"] == "cfi-v2"


def test_bootstrap_keeps_flex_from_legacy_marker(
    data_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, installs: list[str]
) -> None:
    flex = _make_archive(tmp_path, "flex-v1")
    monkeypatch.setattr(settings, "data_archive_url", flex)
    bootstrap.main()
    (data_dir / bootstrap.STATE).unlink()  # Volume, заповнений старим bootstrap
    (data_dir / bootstrap.LEGACY_MARKER).write_text(flex)

    studies = _make_studies_archive(tmp_path, "cfi-v1")
    monkeypatch.setattr(settings, "data_archive_urls", [flex, studies])
    bootstrap.main()
    assert installs == [flex, studies]  # FLEX качався лише першим запуском
    assert not (data_dir / bootstrap.LEGACY_MARKER).exists()
    assert (data_dir / "cfi" / "cfi.duckdb").exists()
