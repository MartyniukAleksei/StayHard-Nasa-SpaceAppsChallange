"""Логіка SAME-R: рядки таблиці, покриття і телеметрія тесту з `sources` (ADR 0006).
Дані — схема `samer` у flame.duckdb (repository); ТЕМ-знімки — з PSI на вимогу."""

import io
import math
from functools import lru_cache
from typing import Any
from urllib.parse import quote

from duckdb import DuckDBPyConnection
from PIL import Image

from flame.core.citations import API_PREFIX, Source, doi_url, media_url, study_series_url, test_url
from flame.media import psi
from flame.studies.same_r import repository
from flame.studies.same_r.schemas import (
    DocGroup,
    FileItem,
    Overview,
    Photos,
    TemArchive,
    TemImage,
    TemOut,
    TestDetail,
    TestList,
    TimeSeries,
)

STUDY = "PSI-101"
SIGNAL = "hkp"


class NotFound(LookupError):
    pass


def test_name(test_no: int) -> str:
    return f"SAME-R #{test_no}"


def _fmt(v: Any, unit: str = "") -> str:
    return "not recorded" if v is None else f"{v:g}{unit}" if isinstance(v, float) else f"{v}{unit}"


def test_source(row: dict[str, Any]) -> Source:
    """Текст рядка таблиці для цитування: значення як у samer.tests, без обчислень."""
    text = (
        f"SAME-R test {row['test_id']} ({_fmt(row.get('date_2010'))} 2010): "
        f"material {_fmt(row.get('material'))}; description {_fmt(row.get('description'))}; "
        f"inlet velocity {_fmt(row.get('inlet_velocity_cm_s'), ' cm/s')}; "
        f"heater resistance ratio Rt/R0 {_fmt(row.get('heater_rt_r0'))}; "
        f"heating duration {_fmt(row.get('heating_s'), ' s')}; "
        f"net aging time {_fmt(row.get('net_aging_s'), ' s')}."
    )
    return Source(
        url=test_url(STUDY, row["test_no"]),
        title=f"SAME-R test {row['test_id']} — experiment table",
        text=text,
    )


def _dataset_source(cur: DuckDBPyConnection) -> list[Source]:
    doi = repository.about(cur).get("doi")
    if not doi:
        return []
    title = "SAME-R (PSI-101) dataset, NASA Physical Sciences Informatics"
    return [Source(url=doi_url(doi), title=title, text=f"{title}, DOI {doi}.")]


_LIST_FIELDS = ("ptrak_peak_per_cc", "active_detectors")
BASE = f"{API_PREFIX}/studies/same-r"


def psi_url(name: str) -> str:
    return f"{BASE}/psi/{quote(name)}"


def list_tests(cur: DuckDBPyConnection) -> TestList:
    cov = repository.coverage(cur)
    tem = {a["test"] for a in repository.tem_archives(cur)}
    # покриття телеметрії й наявність ТЕМ — для карти й фільтрів сторінки тестів
    rows = [
        {
            **r,
            **{k: (cov.get(r["test_no"]) or {}).get(k) for k in _LIST_FIELDS},
            "has_tem": r["test_no"] in tem,
        }
        for r in repository.tests(cur)
    ]
    return TestList(tests=rows, sources=[test_source(r) for r in rows] + _dataset_source(cur))


def _file(test_no: int, f: dict[str, Any]) -> FileItem:
    """Файл прогону: локальна копія зі знімка, якщо є, інакше редирект на PSI."""
    local = repository.local_file(test_no, f["category"], f["name"])
    rel = local.relative_to(repository.study_dir()).as_posix() if local else None
    return FileItem(
        name=f["name"],
        title=f["name"].removeprefix(f"PSI-101_{f['category']}_").rsplit(".", 1)[0],
        url=media_url(STUDY, rel) if rel else psi_url(f["name"]),
        bytes=f["bytes"] or 0,
        category=f["category"],
        local=rel is not None,
    )


def get_test(cur: DuckDBPyConnection, test_no: int) -> TestDetail:
    rows = repository.tests(cur, test_no)
    if not rows:
        raise NotFound(f"no {test_name(test_no)} in the experiment table")
    return TestDetail(
        test_no=test_no,
        rows=rows,
        coverage=repository.coverage(cur, test_no).get(test_no),
        tem_archives=repository.tem_archives(cur, test_no),
        files=[_file(test_no, f) for f in repository.test_files(cur, test_no)],
        url=test_url(STUDY, test_no),
        sources=[test_source(r) for r in rows] + _dataset_source(cur),
    )


def get_timeseries(
    cur: DuckDBPyConnection, test_no: int, signal: str, max_points: int
) -> TimeSeries:
    if signal != SIGNAL:
        raise NotFound(f"unknown signal {signal!r}; one of ['{SIGNAL}']")
    data = repository.hkp(cur, test_no)
    if data is None:
        raise NotFound(f"no {signal} time series for {test_name(test_no)}")
    cols, rows = data
    step = max(1, math.ceil(len(rows) / max_points))
    sampled = rows[::step]
    if sampled[-1] is not rows[-1]:
        sampled.append(rows[-1])  # остання точка завжди в даних, як у FLEX
    # джерело — сирий ряд samer.ts_sensors у загальному API досліджень (studies/psi)
    url = study_series_url(repository.SLUG, test_no, "sensors")
    text = (
        f"{signal} telemetry of {test_name(test_no)}: {len(rows)} samples at 1 Hz, "
        f"t_s from {rows[0][0]:g} to {rows[-1][0]:g} s (0 = heater on); columns {', '.join(cols)}."
    )
    return TimeSeries(
        test_no=test_no,
        signal=signal,
        columns=cols,
        rows=sampled,
        n_total=len(rows),
        url=url,
        sources=[Source(url=url, title=f"{test_name(test_no)} {signal} telemetry", text=text)]
        + _dataset_source(cur),
    )


TEM_MAX_SIDE = 1024
_IMAGE_EXT = (".tif", ".tiff", ".jpg", ".jpeg", ".png", ".bmp")


def get_overview(cur: DuckDBPyConnection) -> Overview:
    a = repository.about(cur)
    return Overview(
        acronym=a.get("investigationAcronym", "SAME-R"),
        title=a.get("title", ""),
        accession=a.get("accession", STUDY),
        doi=a.get("doi"),
        objective=a.get("objective", ""),
        hypothesis=a.get("hypothesis", ""),
        flight_program=a.get("flightProgram", ""),
        start_date=a.get("investigationStartDate", ""),
        end_date=a.get("investigationEndDate", ""),
        documents=[
            DocGroup(
                category=g["category"],
                files=[
                    FileItem(
                        **{k: v for k, v in f.items() if k != "path"},
                        url=media_url(STUDY, f["path"]),
                        local=True,
                    )
                    for f in g["files"]
                ],
            )
            for g in repository.documents()
        ],
        sources=_dataset_source(cur),
    )


def psi_file(cur: DuckDBPyConnection, name: str) -> dict[str, Any]:
    """Файл PSI-101 з переліку знімка; інших імен не віддаємо (захист редиректу)."""
    f = repository.psi_file(cur, name)
    if f is None:
        raise NotFound(f"no file {name!r} in SAME-R")
    return f


def _archives(cur: DuckDBPyConnection, test_no: int) -> list[dict[str, Any]]:
    archives = repository.tem_archives(cur, test_no)
    if not archives and not repository.tests(cur, test_no):
        raise NotFound(f"no {test_name(test_no)} in the experiment table")
    return archives


def _images(a: dict[str, Any]) -> list[str]:
    z = psi.open_zip(a["name"], str(a["version"]), int(a["bytes"]))
    return sorted(m for m in z.members if m.lower().endswith(_IMAGE_EXT))


def get_tem(cur: DuckDBPyConnection, test_no: int) -> TemOut:
    """ТЕМ-знімки тесту: каталоги zip з PSI (Range-читання, без завантаження архівів)."""
    out = []
    for k, a in enumerate(_archives(cur, test_no)):
        out.append(
            TemArchive(
                psi_file=a["name"],
                sample_id=a["sample_id"],
                aging=a["aging"],
                images=[
                    TemImage(
                        name=m.rsplit("/", 1)[-1], url=f"{BASE}/tests/{test_no}/tem/{k}/{i}.jpg"
                    )
                    for i, m in enumerate(_images(a))
                ],
            )
        )
    sources = [
        Source(
            url=psi_url(a.psi_file),
            title=f"{test_name(test_no)} TEM images ({a.psi_file})",
            text=f"TEM images of particles from {test_name(test_no)}, archive {a.psi_file}.",
        )
        for a in out
    ]
    return TemOut(test_no=test_no, archives=out, sources=sources + _dataset_source(cur))


def tem_jpeg(cur: DuckDBPyConnection, test_no: int, k: int, i: int, max_side: int | None) -> bytes:
    archives = _archives(cur, test_no)
    if not 0 <= k < len(archives):
        raise NotFound(f"{test_name(test_no)} has no TEM archive {k}")
    a = archives[k]
    members = _images(a)
    if not 0 <= i < len(members):
        raise NotFound(f"no image {i} in {a['name']}")
    full = _render(a["name"], str(a["version"]), int(a["bytes"]), members[i])
    return _shrink(full, max_side) if max_side and max_side < TEM_MAX_SIDE else full


def _jpeg(img: Image.Image, max_side: int) -> bytes:
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


@lru_cache(maxsize=512)
def _shrink(jpeg: bytes, max_side: int) -> bytes:
    """Мініатюра з уже готового JPEG: без повторного читання з PSI."""
    return _jpeg(Image.open(io.BytesIO(jpeg)), max_side)


@lru_cache(maxsize=256)
def _render(name: str, version: str, size: int, member: str) -> bytes:
    """ТЕМ tif (8-біт палітра або 16-біт) → JPEG у відтінках сірого; відображення, не вимір.
    Один Range-запит до PSI на знімок: мініатюри робить `_shrink` з цього JPEG."""
    img = Image.open(io.BytesIO(psi.open_zip(name, version, size).read(member)))
    if img.mode.startswith("I"):
        img = img.point(lambda v: v / 256)  # 16 біт → 8 біт
    return _jpeg(img.convert("L"), TEM_MAX_SIDE)


PHOTO_MAX_SIDE = 1600


def get_photos(cur: DuckDBPyConnection) -> Photos:
    """Фото екіпажу з апаратурою SAME-R: zip у docs/ знімка (локально, без PSI)."""
    names = repository.photo_members()
    if not names:
        raise NotFound("no SAME-R flight photos in the snapshot")
    return Photos(
        psi_file=repository.PHOTOS_ZIP,
        images=[
            TemImage(name=m.rsplit("/", 1)[-1], url=f"{BASE}/photos/{i}.jpg")
            for i, m in enumerate(names)
        ],
        sources=[
            Source(
                url=psi_url(f"PSI-101_{repository.PHOTOS_ZIP}"),
                title="SAME-R flight operations photos (NASA)",
                text="ISS crew photos of the SAME-R hardware in the Microgravity Science Glovebox.",
            )
        ]
        + _dataset_source(cur),
    )


def photo_jpeg(i: int, max_side: int | None) -> bytes:
    names = repository.photo_members()
    if not 0 <= i < len(names):
        raise NotFound(f"no photo {i}")
    full = _render_photo(names[i])
    return _shrink(full, max_side) if max_side and max_side < PHOTO_MAX_SIDE else full


@lru_cache(maxsize=64)
def _render_photo(member: str) -> bytes:
    img = Image.open(io.BytesIO(repository.read_photo(member))).convert("RGB")
    return _jpeg(img, PHOTO_MAX_SIDE)


# Колонки ряду hkp, які агент може намалювати: підпис і одиниця.
CHART_COLUMNS: dict[str, tuple[str, str]] = {
    "ptrak_per_cc": ("P-Trak particle count", "particles/cm³"),
    "dusttrak_b_mg_m3": ("DustTrak B smoke mass", "mg/m³"),
    "dusttrak_a_mg_m3": ("DustTrak A smoke mass", "mg/m³"),
    "plume_c": ("smoke (plume) temperature", "°C"),
    "iss_scatter_v": ("ISS detector, light scatter", "V"),
    "iss_obscuration_v": ("ISS detector, obscuration", "V"),
    "sts_v": ("STS ionization detector", "V"),
    "ion_a_v": ("ion detector A", "V"),
    "ion_b_v": ("ion detector B", "V"),
    "heating": ("heater on (1) / off (0)", ""),
}
CHART_POINTS = 400
_TONES = ["s1", "s2", "ink"]


def chart(cur: DuckDBPyConnection, column: str, test_nos: list[int]) -> dict[str, Any]:
    """Одна колонка телеметрії в часі (t = 0 — увімкнення нагрівача) для 1–3 тестів на спільних
    осях: подія `chart` для чату агента (та сама форма, що в studies/flex/charts.line)."""
    if column not in CHART_COLUMNS:
        raise NotFound(f"unknown column {column!r}; one of {', '.join(CHART_COLUMNS)}")
    if not 1 <= len(test_nos) <= 3:
        raise NotFound("a SAME-R chart takes 1-3 tests")
    label, unit = CHART_COLUMNS[column]
    series, sources, notes = [], [], []
    for i, n in enumerate(test_nos):
        if not repository.tests(cur, n):
            raise NotFound(f"no {test_name(n)} in the experiment table")
        data = repository.hkp(cur, n)
        if data is None:
            notes.append(f"{test_name(n)}: no telemetry")
            continue
        cols, rows = data
        k = cols.index(column)
        pts = [[r[0], r[k]] for r in rows if r[k] is not None]
        if not pts:
            notes.append(f"{test_name(n)}: no valid {label} readings")
            continue
        step = max(1, math.ceil(len(pts) / CHART_POINTS))
        thin = pts[::step] + ([pts[-1]] if (len(pts) - 1) % step else [])
        name = test_name(n)
        series.append(
            {"id": name, "label": name, "points": thin, "kind": "line", "tone": _TONES[i]}
        )
        ys = [p[1] for p in pts]
        # детектор може реагувати і зростанням, і падінням сигналу: даємо обидва екстремуми з часом
        lo_t, hi_t = pts[ys.index(min(ys))][0], pts[ys.index(max(ys))][0]
        text = (
            f"{label} of {name} over time from heater on: {len(pts)} readings at 1 Hz from "
            f"{pts[0][0]:g} to {pts[-1][0]:g} s; lowest {min(ys):g} {unit} at t = {lo_t:g} s, "
            f"highest {max(ys):g} {unit} at t = {hi_t:g} s. Instrument status codes are left out."
        )
        sources.append(
            Source(
                url=study_series_url(repository.SLUG, n, "sensors"),
                title=f"{name} {label}",
                text=text,
            )
        )
    if not series:
        raise NotFound("; ".join(notes) or "no data to plot")
    return {
        "chart": {
            "kind": "line",
            "title": f"{label} — {', '.join(s['label'] for s in series)}",
            "x_label": "time from heater on, s",
            "y_label": f"{label}, {unit}" if unit else label,
            "derived": False,
            "series": series,
            "test_nos": [],  # FLEX-номери; для SAME-R — study + test_ids
            "study": "samer",
            "doi": repository.about(cur).get("doi"),
            "test_ids": [int(s["id"].rsplit("#", 1)[1]) for s in series],
            "notes": notes,
        },
        "sources": sources,
    }
