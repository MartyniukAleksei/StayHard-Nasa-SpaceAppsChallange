"""Логіка Огляду FLEX: паспорт дослідження, факти, пресети-питання, replay тесту."""

import csv
import io
import re
from dataclasses import dataclass
from typing import Any

from duckdb import DuckDBPyConnection

from flame.media import files as media
from flame.studies.flex.pages import repository as repo
from flame.studies.flex.pages.schemas import (
    About,
    Contact,
    DocumentGroup,
    EndCounts,
    Facts,
    FileItem,
    Library,
    Limitations,
    Neighbor,
    Overview,
    Preset,
    PresetGroup,
    Publication,
    Replay,
    TestDetail,
    TestSummary,
    VideoItem,
)

STUDY = "flex"
MAX_REPLAY_POINTS = 500
NEIGHBORS = 5


class StudyDataMissing(LookupError):
    """У БД немає даних дослідження (не зібрано build_db)."""


@dataclass(frozen=True)
class PresetDef:
    id: str
    question: str
    groups: tuple[tuple[str, str], ...]  # (group_id із repository.GROUP_WHERE, підпис)
    derived: bool = False
    note: str | None = None


PRESETS: tuple[PresetDef, ...] = (
    PresetDef("iss_air", "Does the flame go out by itself in ISS air?", (("iss_air", "ISS air"),)),
    PresetDef(
        "lunar",
        'How does it burn in a "lunar" atmosphere (≈0.7 atm, ≥30% O₂)?',
        (("lunar", "Lunar-like"),),
    ),
    PresetDef(
        "co2_vs_he",
        "CO₂ or He: which extinguishes better?",
        (("co2", "CO₂"), ("he", "He")),
    ),
    PresetDef(
        "cool_flames",
        "What are cool flames?",
        (("cool_flames", "Cool flame mentioned"),),
        derived=True,
        note="Derived: tests whose researcher comment mentions a cool flame.",
    ),
    PresetDef(
        "clean_d2",
        'Check the d² law yourself: "clean" tests',
        (("clean_d2", "Clean tests"),),
        derived=True,
        note="Derived: free droplet, not Disruption, droplet and flame series present.",
    ),
    PresetDef(
        "fuel",
        "Methanol or heptane?",
        (("methanol", "Methanol"), ("heptane", "Heptane")),
    ),
)


def _contact(raw: dict[str, Any]) -> Contact:
    name = " ".join(p for p in (raw.get("firstName"), raw.get("lastName")) if p)
    roles = ", ".join(r.get("annotationValue", "") for r in raw.get("roles", []) if r)
    return Contact(name=name, affiliation=raw.get("affiliation", ""), role=roles)


def _citation(a: dict[str, Any]) -> str:
    return (
        f"NASA Physical Sciences Informatics (PSI). {a['title']} "
        f"({a['investigationAcronym']}, {a['accession']}). https://doi.org/{a['doi']}. "
        f"{a['licenseName']}."
    )


def build_about(a: dict[str, Any]) -> About:
    pubs = a.get("publications", [])
    return About(
        title=a["title"],
        acronym=a["investigationAcronym"],
        accession=a["accession"],
        objective=a.get("objective", ""),
        hypothesis=a.get("hypothesis", ""),
        approach=a.get("approach", ""),
        research_impacts=a.get("researchImpacts", ""),
        hardware=a.get("experimentHardware", ""),
        flight_program=a.get("flightProgram", ""),
        contacts=[_contact(c) for c in a.get("contacts", [])],
        doi=a["doi"],
        license_name=a.get("licenseName", ""),
        license_link=a.get("licenseLink", ""),
        n_publications=len(pubs),
        n_publications_with_doi=sum(1 for p in pubs if p.get("doi")),
        citation=_citation(a),
    )


def _group(cur: DuckDBPyConnection, group_id: str, label: str) -> PresetGroup:
    c = repo.count_group(cur, group_id)
    return PresetGroup(
        id=group_id,
        label=label,
        total=c["total"],
        by_end=EndCounts(
            extinction=c["extinction"], completion=c["completion"], disruption=c["disruption"]
        ),
        excluded_fiber=c["fiber"],
        excluded_fiber_unknown=c["fiber_unknown"],
    )


def build_presets(cur: DuckDBPyConnection) -> list[Preset]:
    return [
        Preset(
            id=p.id,
            question=p.question,
            groups=[_group(cur, gid, label) for gid, label in p.groups],
            derived=p.derived,
            note=p.note,
        )
        for p in PRESETS
    ]


def get_overview(cur: DuckDBPyConnection) -> Overview:
    about = repo.get_about(cur, STUDY)
    if about is None:
        raise StudyDataMissing(STUDY)
    return Overview(
        about=build_about(about),
        facts=Facts(**repo.get_facts(cur)),
        presets=build_presets(cur),
    )


def downsample(points: list[tuple[float, float]], limit: int) -> list[tuple[float, float]]:
    """Рівномірно проріджує ряд до ≤ limit точок, зберігаючи першу й останню."""
    if len(points) <= limit:
        return list(points)
    step = (len(points) - 1) / (limit - 1)
    return [points[round(i * step)] for i in range(limit)]


def get_replay(cur: DuckDBPyConnection, test_no: int) -> Replay | None:
    head = repo.get_test_header(cur, test_no)
    if head is None:
        return None
    return Replay(
        **head,
        droplet=downsample(repo.get_droplet_series(cur, test_no), MAX_REPLAY_POINTS),
        flame=downsample(repo.get_flame_series(cur, test_no), MAX_REPLAY_POINTS),
        standoff=downsample(repo.get_standoff_series(cur, test_no), MAX_REPLAY_POINTS),
    )


def list_tests(cur: DuckDBPyConnection) -> list[TestSummary]:
    videos = media.tests_with_video()
    return [
        TestSummary(
            **{k: v for k, v in r.items() if k != "ts_fiber"},
            fiber=r["ts_fiber"],
            has_video=r["test_no"] in videos,
        )
        for r in repo.list_tests(cur)
    ]


def list_videos(cur: DuckDBPyConnection) -> list[VideoItem]:
    """Усі mp4 з data/flex/media, з умовами їхніх тестів (порядок — за номером тесту)."""
    rows = {r["test_no"]: r for r in repo.list_tests(cur)}
    items = []
    for test_no in sorted(media.tests_with_video()):
        r = rows.get(test_no)
        if r is None:
            continue
        for v in media.list_videos(test_no):
            if not str(v["name"]).lower().endswith(".mp4"):
                continue
            items.append(
                VideoItem(
                    test_no=test_no,
                    fuel=r["fuel"],
                    diluent=r["diluent"],
                    x_o2=r["x_o2"],
                    p_atm=r["p_atm"],
                    end_type=r["end_type"],
                    name=str(v["name"]),
                    path=str(v["path"]),
                    bytes=int(str(v["bytes"])),
                )
            )
    return items


def _str(v: object) -> str | None:
    return None if v is None else str(v)


def get_test(cur: DuckDBPyConnection, test_no: int) -> TestDetail | None:
    t = repo.get_test(cur, test_no)
    if t is None:
        return None
    comment = t.get("ts_comment") or ""
    return TestDetail(
        test_no=t["test_no"],
        cir_id=t.get("cir_id"),
        test_date=_str(t.get("test_date")),
        test_gmt=_str(t.get("test_gmt")),
        fuel=t["fuel"],
        p_atm=t.get("p_atm"),
        x_o2=t.get("x_o2"),
        x_n2=t.get("x_n2"),
        x_co2=t.get("x_co2"),
        x_he=t.get("x_he"),
        diluent=t["diluent"],
        d0_mm=t.get("d0_mm"),
        dext_mm=t.get("dext_mm"),
        k_mm2_s=t.get("k_mm2_s"),
        burn_time_s=t.get("burn_time_s"),
        end_type=t["end_type"],
        fiber=t.get("ts_fiber"),
        temperature_k=t.get("ts_temperature_k"),
        comment=comment,
        cool_flame=bool(re.search(repo.COOL_FLAME_PATTERN, comment.lower())),
        has_series=bool(t.get("has_droplet_ts")),
        has_3d=bool(t.get("has_droplet_ts")),
        neighbors=[Neighbor(**n) for n in repo.find_neighbors(cur, test_no, NEIGHBORS)],
        files=[FileItem(**f) for f in media.list_test_files(test_no)],
        videos=[FileItem(**f) for f in media.list_videos(test_no)],
    )


def series_csv(cur: DuckDBPyConnection, test_no: int) -> str | None:
    if repo.get_test_header(cur, test_no) is None:
        return None
    raw = repo.get_about(cur, STUDY)
    source = build_about(raw).citation if raw else "NASA PSI"
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow([f"# FLEX test {test_no}. Source: {source}"])
    w.writerow(["signal", "t_s", "value"])
    w.writerows(repo.get_full_series(cur, test_no))
    return buf.getvalue()


def get_library(cur: DuckDBPyConnection) -> Library:
    raw = repo.get_about(cur, STUDY)
    if raw is None:
        raise StudyDataMissing(STUDY)
    about = build_about(raw)
    pubs = [
        Publication(title=p.get("title", ""), authors=p.get("authorList", ""), doi=p.get("doi", ""))
        for p in raw.get("publications", [])
    ]
    docs = [
        DocumentGroup(category=g["category"], files=[FileItem(**f) for f in g["files"]])
        for g in media.list_documents()
    ]
    return Library(
        citation=about.citation,
        doi=about.doi,
        license_name=about.license_name,
        license_link=about.license_link,
        publications=pubs,
        documents=docs,
        limitations=Limitations(
            **repo.get_limitations(cur), with_video=len(media.tests_with_video())
        ),
    )
