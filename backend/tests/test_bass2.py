"""BASS-II: журнал Додатку A, розбір матеріалів, ендпоінти /api/studies/bass2/*."""

import pytest
from fastapi.testclient import TestClient

from flame.db.duckdb import db_available, get_connection
from flame.ingest.bass2_outcomes import OUTCOMES
from flame.main import app
from flame.media import files as media
from flame.studies.bass2 import service

client = TestClient(app)


def _has_bass2() -> bool:
    if not db_available():
        return False
    row = get_connection().execute("SELECT count(*) FROM studies WHERE slug = 'bass2'").fetchone()
    return bool(row and row[0])


needs_bass2 = pytest.mark.skipif(not _has_bass2(), reason="bass2 is not in flame.duckdb")


# --- appendix_a.json (закомічений, не потребує БД) ----------------------------------


def test_appendix_covers_2014_tests_with_outcomes() -> None:
    tests = service.appendix()["tests"]
    ids = {t["test_id"] for t in tests}

    assert len(tests) == 126 == len(ids)  # 129 у PSI мінус O20–O22 (2016, не у звіті)
    assert ids == set(OUTCOMES)
    assert not ids & {"O20", "O21", "O22"}
    assert {t["flow_config"] for t in tests} <= {"Opposed", "Concurrent", "Stagnation", None}
    assert all(103 <= t["report_page"] <= 113 for t in tests)


def test_appendix_outcomes_match_pi_statements() -> None:
    log = service.log_by_test()
    # T'ien, p.95: six quenching, three non-ignited, one blowoff (fabric, BASS-II, not reused)
    fabric = [t for tid, t in log.items() if tid.startswith("T") and tid != "T3" and tid != "T7"]
    fresh = [t for t in fabric if not t["reused_sample"]]
    by = {o: sum(t["outcome"] == o for t in fresh) for o in ("quench", "no_ignition", "blowoff")}
    assert by == {"quench": 6, "no_ignition": 3, "blowoff": 1}
    # Olson, p.68–69: lowest quench O4 (14.8 → 13.6), no ignition at/below ~14.5
    assert log["O4"]["outcome"] == "quench" and log["O4"]["o2_cal_final_pct"] == "13.6"
    assert all(log[t]["outcome"] == "no_ignition" for t in ("O12", "O16", "O5b"))


def test_tien_table_keeps_bass1_rows_apart() -> None:
    rows = service.appendix()["tien_table_7_1"]
    bass1 = {r["test_id"] for r in rows if r["campaign"] == "BASS"}

    assert bass1 == {"T7", "T8", "T10", "T11"}
    assert service._pi_table_row("T10")["campaign"] == "BASS-II"  # не рядок BASS-I


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("100 micron PMMA film   2 cm wide", ("pmma_film", 0.1, None)),
        ("2 cm 0.2 mm PMMA film", ("pmma_film", 0.2, None)),
        ("5 mm thick PMMA 2 cm wide", ("pmma_slab", 5.0, None)),
        ('1/4" black rod', ("pmma_rod", None, 6.35)),
        ("1/4 blac rod", ("pmma_rod", None, 6.35)),
        ('0.5" black rod', ("pmma_rod", None, 12.7)),
        ("4 cm spherical section", ("pmma_sphere", None, 40.0)),
        ("2 cm SIBAL", ("fabric", None, None)),
        ("Nomex natural (nomex III)", ("nomex", None, None)),
        ("Japan Wax candle", ("candle", None, None)),
    ],
)
def test_classify_material(text: str, expected: tuple) -> None:
    assert service.classify_material(text) == expected


def test_media_bass2_rejects_paths_outside_snapshot() -> None:
    assert media.resolve("bass2", "../flex/about.json") is None
    assert media.resolve("bass2", "about.json") is None


# --- API (потрібна зібрана БД з bass2) --------------------------------------------------


@needs_bass2
def test_tests_list_joins_appendix_and_flags_source_errors() -> None:
    rows = {r["test_id"]: r for r in client.get("/api/studies/bass2/tests").json()}

    assert len(rows) == 129
    assert sum(r["in_report_log"] for r in rows.values()) == 126
    assert rows["O13a"]["flow_config"] == "Concurrent" and rows["O13a"]["outcome"] == "quench"
    assert rows["O20"]["outcome"] is None  # 2016, у звіті немає
    assert rows["P22b"]["o2_final_suspect"] and rows["T28b"]["o2_final_suspect"]
    assert not rows["O13a"]["o2_final_suspect"]
    assert rows["O12"]["co_over_range"]
    assert all(r["material_class"] != "other" for r in rows.values())


@needs_bass2
def test_overview_facts_and_cited_findings() -> None:
    d = client.get("/api/studies/bass2/overview").json()

    assert d["accession"] == "PSI-25" and d["doi"] == "10.60555/4qc4-de67"
    assert d["facts"]["n_tests"] == 129 and d["facts"]["n_pi"] == 6
    assert d["facts"]["last_year"] == 2016  # T9/T18 «2018» — помилка джерела
    f = {x["id"]: x for x in d["findings"]}
    assert f["rod_min_o2"]["value"] == "13.5% O₂" and f["rod_min_o2"]["page"] == 76
    assert f["rod_min_o2"]["source"]["url"].endswith("#page=84")  # PDF-сторінка = p. + 8


@needs_bass2
def test_test_detail_has_log_files_and_sources() -> None:
    d = client.get("/api/studies/bass2/tests/O13a").json()

    assert d["log"]["table"] == "A.5" and "self-extinguished" in d["log"]["observations"]
    assert d["videos"] and d["videos"][0]["url"].startswith("/api/media/bass2/files/media/O13a/")
    assert any(s["url"].startswith("https://doi.org/") for s in d["sources"])
    assert client.get(d["videos"][0]["url"], headers={"Range": "bytes=0-99"}).status_code == 206


@needs_bass2
def test_test_detail_errors() -> None:
    assert client.get("/api/studies/bass2/tests/X1").status_code == 422
    assert client.get("/api/studies/bass2/tests/B99").status_code == 404


@needs_bass2
def test_psi_video_redirects_to_signed_url(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []

    def fake(study: str, name: str, version: str) -> str:
        calls.append((study, name))
        return f"https://s3.example/{name}?sig=1"

    monkeypatch.setattr(service.psi, "signed_url", fake)
    d = client.get("/api/studies/bass2/tests/O13a").json()
    main = d["psi_videos"][0]
    r = client.get(main["url"], follow_redirects=False)

    assert main["label"].startswith("Experiment video") and "Still" not in main["name"]
    assert r.status_code == 307 and r.headers["location"].startswith("https://s3.example/")
    assert calls == [("PSI-25", "PSI-25_Raw Data_BASS_GMT202_SAMPLE_221_TEST_O13a.mp4")]
    assert client.get(f"{main['url'][:-1]}99", follow_redirects=False).status_code == 404


@needs_bass2
def test_video_series_points_to_its_psi_video() -> None:
    d = client.get("/api/studies/bass2/tests/O13a").json()
    vs = d["video_series"]

    assert vs is not None and vs["columns"][0] == "t_s"
    assert d["psi_videos"][vs["psi_video_index"]]["name"].endswith("TEST_O13a.mp4")
    assert len(vs["points"]) > 1000
    assert client.get("/api/studies/bass2/tests/B1").json()["video_series"] is None
