"""Логіка сторінок BASS-II: паспорт, факти, ключові висновки звіту, Дослідник, сторінка тесту.

Умови тестів — з `bass2.tests` (CSV PSI 1:1). Тип потоку, результат тесту й нотатки — з
журналу Додатку A (`appendix_a.json`), у UI вони позначені *derived*. Клас матеріалу,
товщина й діаметр — розбір тексту колонки `material` (теж *derived*).
"""

import json
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

from duckdb import DuckDBPyConnection

from flame.core import citations
from flame.core.config import settings
from flame.media import psi
from flame.studies.bass2 import repository as repo
from flame.studies.bass2.findings import FINDINGS, PAGE_OFFSET, REPORT_FILE, REPORT_TITLE
from flame.studies.bass2.schemas import (
    CountItem,
    Facts,
    FileItem,
    FindingOut,
    LogEntry,
    Overview,
    PsiFile,
    PsiVideo,
    TestDetail,
    TestRow,
    VideoSeries,
)

ACCESSION = "PSI-25"
SLUG = "bass2"
APPENDIX = Path(__file__).with_name("appendix_a.json")
VIDEO_SERIES = Path(__file__).with_name("video_series.json")
O2_PLAUSIBLE = (10.0, 25.0)  # поза цим діапазоном фінальний O₂ — помилка джерела (B2, P22b…)
OVER_RANGE = re.compile(r"OR|over|>", re.I)

MATERIAL_LABELS = {
    "pmma_film": "PMMA film",
    "pmma_slab": "PMMA slab",
    "pmma_rod": "PMMA rod",
    "pmma_sphere": "PMMA sphere",
    "fabric": "SIBAL fabric",
    "nomex": "Nomex III",
    "candle": "Wax candle",
    "other": "Other",
}
FLOW_LABELS = {
    "Opposed": "Opposed flow",
    "Concurrent": "Concurrent flow",
    "Stagnation": "Stagnation flow",
}
OUTCOME_LABELS = {
    "quench": "Self-extinguished (low flow)",
    "blowoff": "Blown off (high flow)",
    "no_ignition": "Did not ignite",
    "flow_off": "Put out by stopping the fan",
    "burnout": "Burned the whole sample",
    "sustained": "Still burning at test end",
    "unknown": "Not stated",
}
ROD_INCH = {"1/4": 6.35, "3/8": 9.525, "1/2": 12.7, "0.5": 12.7}
VIDEO_EXT = (".mp4",)


class StudyDataMissing(LookupError):
    """У БД немає схеми bass2 (знімок не зібрано)."""


@lru_cache(maxsize=1)
def appendix() -> dict[str, Any]:
    return json.loads(APPENDIX.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def video_series_doc() -> dict[str, Any]:
    return json.loads(VIDEO_SERIES.read_text(encoding="utf-8")) if VIDEO_SERIES.exists() else {}


def log_by_test() -> dict[str, dict[str, Any]]:
    return {t["test_id"]: t for t in appendix()["tests"]}


# --- розбір тексту матеріалу (derived) ---------------------------------------------


def classify_material(text: str) -> tuple[str, float | None, float | None]:
    """→ (клас, товщина мм, діаметр мм). Текст у джерелі вільний («1/4 blac rod», «2 cm SIBAL»)."""
    low = text.lower()
    if "sibal" in low:
        return "fabric", None, None
    if "nomex" in low:
        return "nomex", None, None
    if "candle" in low or "wax" in low:
        return "candle", None, None
    if "spher" in low:
        return "pmma_sphere", None, 40.0 if "4 cm" in low else None
    if "rod" in low:
        m = re.search(r'(1/4|3/8|1/2|0\.5)\s*"?', low)
        return "pmma_rod", None, ROD_INCH[m.group(1)] if m else None
    microns = re.search(r"(\d+)\s*micron", low)
    mm = re.search(r"(\d+(?:\.\d+)?)\s*-?\s*mm", low)
    thickness = int(microns.group(1)) / 1000 if microns else float(mm.group(1)) if mm else None
    if microns or "film" in low or (thickness is not None and thickness < 0.5):
        return "pmma_film", thickness, None
    if "pmma" in low:
        return "pmma_slab", thickness, None
    return "other", thickness, None


# --- джерела -----------------------------------------------------------------------


def report_source(page: int, title: str, text: str) -> citations.Source:
    url = citations.media_url(ACCESSION, REPORT_FILE, page=page + PAGE_OFFSET)
    return citations.Source(url=url, title=f"{REPORT_TITLE}, p. {page}", text=text)


def doi_source(about: dict[str, Any]) -> citations.Source:
    return citations.Source(
        url=citations.doi_url(about["doi"]),
        title=f"NASA PSI {about['accession']} ({about['investigationAcronym']})",
        text=about.get("title", ""),
    )


def _citation(a: dict[str, Any]) -> str:
    return (
        f"NASA Physical Sciences Informatics (PSI). {a['title']} "
        f"({a['investigationAcronym']}, {a['accession']}). https://doi.org/{a['doi']}. "
        f"{a.get('licenseName', '')}."
    )


# --- файли знімка ------------------------------------------------------------------


def _local_files(sub: str, test_id: str) -> list[FileItem]:
    base = settings.study_dir(SLUG)
    folder = base / sub / test_id
    if not folder.is_dir():
        return []
    return [
        FileItem(
            name=f.name,
            url=citations.media_url(ACCESSION, f.relative_to(base).as_posix()),
            bytes=f.stat().st_size,
            kind="Video" if f.suffix.lower() in VIDEO_EXT else "Nikon still proof sheet (PDF)",
        )
        for f in sorted(folder.iterdir())
        if f.is_file() and not f.name.startswith(".")
    ]


def tests_with_video() -> set[str]:
    media = settings.study_dir(SLUG) / "media"
    if not media.is_dir():
        return set()
    return {d.name for d in media.iterdir() if d.is_dir() and any(d.glob("*.mp4"))}


# --- рядки -------------------------------------------------------------------------


def _num(v: Any) -> float | None:
    return None if v is None else float(v)


def _row(t: dict[str, Any], log: dict[str, Any] | None, with_video: set[str]) -> TestRow:
    cls, thickness, diameter = classify_material(t["material"] or "")
    o2f = _num(t["o2_final_pct"])
    co_raw = (log or {}).get("co_final_ppm") or ""
    return TestRow(
        test_id=t["test_id"],
        pi=t["pi"],
        test_date=t["test_date"].isoformat() if t["test_date"] else None,
        gmt_day=int(t["gmt_day"]) if t["gmt_day"] is not None else None,
        material=t["material"] or "",
        material_class=cls,
        thickness_mm=thickness,
        diameter_mm=diameter,
        flow_restrictor=int(t["flow_restrictor"]) if t["flow_restrictor"] is not None else None,
        o2_initial_pct=_num(t["o2_initial_pct"]),
        o2_final_pct=o2f,
        o2_final_suspect=o2f is not None and not (O2_PLAUSIBLE[0] <= o2f <= O2_PLAUSIBLE[1]),
        co2_initial_pct=_num(t["co2_initial_pct"]),
        co2_final_pct=_num(t["co2_final_pct"]),
        co_initial_ppm=_num(t["co_initial_ppm"]),
        co_final_ppm=_num(t["co_final_ppm"]),
        co_over_range=bool(OVER_RANGE.search(co_raw)),
        flow_config=(log or {}).get("flow_config"),
        outcome=(log or {}).get("outcome"),
        outcome_confidence=(log or {}).get("outcome_confidence"),
        has_video=t["test_id"] in with_video,
        in_report_log=log is not None,
    )


def _sort_key(test_id: str) -> tuple[str, int, str]:
    m = re.match(r"([A-Z])(\d+)(.*)", test_id)
    return (m.group(1), int(m.group(2)), m.group(3)) if m else (test_id, 0, "")


def list_tests(cur: DuckDBPyConnection) -> list[TestRow]:
    if not repo.has_study(cur):
        raise StudyDataMissing(SLUG)
    logs, video = log_by_test(), tests_with_video()
    rows = [_row(t, logs.get(t["test_id"]), video) for t in repo.list_tests(cur)]
    return sorted(rows, key=lambda r: _sort_key(r.test_id))


def _counts(values: list[str | None], labels: dict[str, str]) -> list[CountItem]:
    c = Counter(v for v in values if v)
    order = list(labels) + sorted(set(c) - set(labels))
    return [CountItem(key=k, label=labels.get(k, k), count=c[k]) for k in order if c[k]]


def get_overview(cur: DuckDBPyConnection) -> Overview:
    about = repo.get_about(cur) if repo.has_study(cur) else None
    if about is None:
        raise StudyDataMissing(SLUG)
    rows = list_tests(cur)
    years = [int(r.test_date[:4]) for r in rows if r.test_date]
    o2 = [r.o2_initial_pct for r in rows if r.o2_initial_pct is not None]
    pis = Counter(r.pi for r in rows)
    facts = Facts(
        n_tests=len(rows),
        n_logged=sum(r.in_report_log for r in rows),
        first_year=min(years),
        last_year=max(y for y in years if y < 2018),  # T9/T18: «2018» — помилка джерела
        n_pi=len(pis),
        o2_min_pct=min(o2),
        o2_max_pct=max(o2),
        n_with_video=sum(r.has_video for r in rows),
        by_pi=[CountItem(key=k, label=k, count=v) for k, v in pis.most_common()],
        by_material=_counts([r.material_class for r in rows], MATERIAL_LABELS),
        by_flow=_counts([r.flow_config for r in rows], FLOW_LABELS),
        by_outcome=_counts([r.outcome for r in rows], OUTCOME_LABELS),
    )
    findings = [
        FindingOut(
            id=f.id,
            group=f.group,
            title=f.title,
            value=f.value,
            earth_value=f.earth_value,
            text=f.text,
            page=f.page,
            figure=f.figure,
            source=report_source(f.page, f.title, f.text),
        )
        for f in FINDINGS
    ]
    return Overview(
        title=about["title"],
        acronym=about["investigationAcronym"],
        accession=about["accession"],
        doi=about["doi"],
        license_name=about.get("licenseName", ""),
        hypothesis=about.get("hypothesis", ""),
        objective=about.get("objective", ""),
        approach=about.get("approach", ""),
        research_impacts=about.get("researchImpacts", ""),
        hardware=about.get("experimentHardware", ""),
        citation=_citation(about),
        facts=facts,
        findings=findings,
        sources=[doi_source(about)],
    )


def _video_label(name: str) -> str:
    low = name.lower()
    view = ", second view" if "2nd_view" in low else ""
    if "still_sequence" in low:
        return "Nikon stills (1 frame/s) as video"
    if "vlc-record" in low:
        return "Short clip"
    if "los_portion" in low:
        return f"Recording during loss of signal{view}"
    return f"Experiment video with data overlay (N₂, air, fan, radiometer){view}"


def _video_rank(name: str) -> int:
    """Основний запис камери → другий ракурс → фрагменти LOS → стоп-кадри → короткі кліпи."""
    low = name.lower()
    ranks = (("vlc-record", 4), ("still_sequence", 3), ("los_portion", 2), ("2nd_view", 1))
    for key, rank in ranks:
        if key in low:
            return rank
    return 0


def psi_videos(cur: DuckDBPyConnection, test_id: str) -> list[dict[str, Any]]:
    """Відео тесту в PSI: спершу основний запис камери, потім фрагменти й стоп-кадри."""
    vids = [f for f in repo.list_test_files(cur, test_id) if f["kind"] == "video"]
    return sorted(vids, key=lambda f: (_video_rank(f["name"]), f["name"]))


def psi_video_url(cur: DuckDBPyConnection, test_id: str, index: int) -> str | None:
    vids = psi_videos(cur, test_id)
    if not 0 <= index < len(vids):
        return None
    f = vids[index]
    return psi.signed_url(ACCESSION, f["name"], f["version"])


def _pi_table_row(test_id: str) -> dict[str, Any] | None:
    a = appendix()
    if test_id.startswith("M"):
        return next((r for r in a["miller_table_5_1"] if r["test_id"] == test_id), None)
    if test_id.startswith("T"):  # лише BASS-II: у табл. 7.1 є рядки BASS-I з тими ж номерами
        rows = [r for r in a["tien_table_7_1"] if r["campaign"] == "BASS-II"]
        return next((r for r in rows if r["test_id"] == test_id), None)
    return None


def get_test(cur: DuckDBPyConnection, test_id: str) -> TestDetail | None:
    if not repo.has_study(cur):
        raise StudyDataMissing(SLUG)
    t = repo.get_test(cur, test_id)
    if t is None:
        return None
    log = log_by_test().get(test_id)
    about = repo.get_about(cur) or {}
    local = {f.name for f in _local_files("media", test_id) + _local_files("raw", test_id)}
    psi_files = [
        PsiFile(name=f["name"], kind=f["kind"], bytes=int(f["bytes"] or 0), version=f["version"])
        for f in repo.list_test_files(cur, test_id)
        if f["kind"] != "video" and not any(f["name"].endswith(n) for n in local)
    ]
    videos_psi = [
        PsiVideo(
            index=i,
            name=f["name"].removeprefix("PSI-25_Raw Data_"),
            label=_video_label(f["name"]),
            bytes=int(f["bytes"] or 0),
            url=f"/api/studies/{SLUG}/tests/{test_id}/psi-video/{i}",
        )
        for i, f in enumerate(psi_videos(cur, test_id))
    ]
    sources = [doi_source(about)] if about else []
    if log:
        sources.append(
            report_source(
                log["report_page"],
                f"Appendix A, Table {log['table']}: test {test_id}",
                log.get("observations") or "",
            )
        )
    entry = LogEntry(**{k: log.get(k) for k in LogEntry.model_fields}) if log is not None else None
    doc = video_series_doc()
    vs = doc.get("tests", {}).get(test_id)
    series = None
    if vs:
        idx = next(
            (i for i, f in enumerate(psi_videos(cur, test_id)) if f["name"] == vs["video_name"]),
            None,
        )
        series = VideoSeries(
            psi_video_index=idx,
            start_gmt=vs["start_gmt"],
            method=doc["method"],
            columns=vs["columns"],
            points=vs["points"],
        )
    return TestDetail(
        test=_row(t, log, tests_with_video()),
        sample_no=t["sample_no"],
        fan_display=t["fan_display"],
        air_display=t["air_display"],
        radiometer_gain=t["radiometer_gain"],
        total_frames=_num(t["total_frames"]),
        frames_note=t["frames_note"],
        log=entry,
        pi_table=_pi_table_row(test_id),
        videos=_local_files("media", test_id),
        files=_local_files("raw", test_id),
        psi_videos=videos_psi,
        psi_files=psi_files,
        video_series=series,
        same_day=repo.same_day(cur, test_id),
        sources=sources,
    )
