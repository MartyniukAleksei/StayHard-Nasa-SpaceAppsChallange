"""Saffire-II: розбір полів таблиці PSI і збирання відповідей API."""

import re
from statistics import fmean
from typing import Any

from duckdb import DuckDBPyConnection

from flame.studies.saffire2 import repository as repo
from flame.studies.saffire2.schemas import (
    About,
    Co2Track,
    Contact,
    Dashboard,
    FileItem,
    Publication,
    Sample,
    SampleFiles,
    SensorStats,
    Series,
    Spread,
    Verdict,
)

SAMPLE_LENGTH_CM = 29.0  # «Length» у таблиці для всіх зразків, крім складеного 2-7
MATCH_TOL_CM = 1.0
# Примітки під таблицею PSI (docs/Experimental table/…csv): у БД їх немає, тут — цитати.
NOTES = {
    "1": "Derived from measured CO2 production and referenced to initial O2 concentration "
    "reported by ISS.",
    "2": "The PMMA portion was completely consumed but the Nomex was not ignited.",
    "3": "This is the length of fuel with significant visible damage.",
    "4": "The flames remain anchored at the base of the sample which has a very slow "
    "regression rate (0.01 to 0.04 mm/s)",
}
NOTE4_RANGE = (0.01, 0.04)  # мм/с, з Note 4


class StudyDataMissing(Exception):
    pass


def burn_length_cm(raw: str | None, full: float = SAMPLE_LENGTH_CM) -> float | None:
    """'Complete' → вся довжина, '~ 0…' → 0, '7.6 cm' / '~ 10 cm (note 3)' → число."""
    s = (raw or "").strip().lower()
    if not s or s.startswith("n/a"):
        return None
    if s.startswith("complete"):
        return full
    m = re.match(r"~?\s*([\d.]+)\s*(cm)?", s)
    return float(m.group(1)) if m else None


def spread(raw: str | None) -> Spread:
    s = (raw or "").strip()
    low = s.lower()
    if low.startswith("acceleratory"):
        return Spread(accelerating=True)
    if low.startswith("note 4"):
        return Spread(lo=NOTE4_RANGE[0], hi=NOTE4_RANGE[1], note="Note 4")
    m = re.match(r"([\d.]+)\s*mm/s", low)
    if m:
        v = float(m.group(1))
        return Spread(lo=v, hi=v)
    return Spread()


def verdict(material: str, ug_cm: float | None, g1_cm: float | None) -> Verdict:
    """Чи земний тест (1g) суворіший за µg. Складений зразок (PMMA & Nomex) не порівнюємо:
    у 1g для нього записано лише Nomex."""
    if "&" in material:
        return "not_comparable"
    if ug_cm is None or g1_cm is None:
        return "unknown"
    if g1_cm > ug_cm + MATCH_TOL_CM:
        return "earth_stricter"
    if ug_cm > g1_cm + MATCH_TOL_CM:
        return "earth_weaker"
    return "match"


def _about(a: dict[str, Any]) -> About:
    pi = next(
        (
            f"{c.get('firstName', '')} {c.get('lastName', '')}".strip()
            for c in a.get("contacts", [])
            if c.get("firstName") or c.get("lastName")
        ),
        "",
    )
    return About(
        acronym=a.get("investigationAcronym", "SAFFIRE-II"),
        title=a.get("title", ""),
        accession=a.get("accession", "PSI-99"),
        doi=a.get("doi", ""),
        flight_program=a.get("flightProgram", ""),
        hardware=a.get("experimentHardware", ""),
        pi=pi,
        start_date=a.get("investigationStartDate", ""),
        end_date=a.get("investigationEndDate", ""),
        objective=a.get("objective", ""),
        hypothesis=a.get("hypothesis", ""),
        license=a.get("licenseIdentifier", ""),
        license_name=a.get("licenseName", ""),
        license_link=a.get("licenseLink", ""),
        citation=(
            f"NASA Physical Sciences Informatics (PSI). {a.get('title', '')} "
            f"({a.get('investigationAcronym', '')}, {a.get('accession', '')}). "
            f"https://doi.org/{a.get('doi', '')}. {a.get('licenseName', '')}."
        ),
        contacts=[
            Contact(
                name=f"{c.get('firstName', '')} {c.get('lastName', '')}".strip(),
                affiliation=c.get("affiliation", ""),
            )
            for c in a.get("contacts", [])
            if c.get("firstName") or c.get("lastName")
        ],
        publications=[
            Publication(
                title=p.get("title", ""), authors=p.get("authorList", ""), doi=p.get("doi", "")
            )
            for p in a.get("publications", [])
        ],
    )


def _r(v: float | None, d: int = 3) -> float | None:
    return None if v is None else round(float(v), d)


def get_dashboard(cur: DuckDBPyConnection) -> Dashboard:
    if not repo.available(cur):
        raise StudyDataMissing
    about = repo.get_about(cur) or {}
    stats = {s["test_id"]: s for s in repo.sensor_stats(cur)}
    samples = []
    for t in repo.list_tests(cur):
        ug, g1 = burn_length_cm(t["ug_burn_length_raw"]), burn_length_cm(t["g1_burn_length_raw"])
        st = stats.get(t["test_id"])
        samples.append(
            Sample(
                test_id=t["test_id"],
                material=t["material"] or "",
                material_filled_down=bool(t["material_filled_down"]),
                thickness_mm=t["thickness_mm"],
                thickness_raw=t["thickness_raw"] or "",
                length_raw=t["length_raw"] or "",
                flow_direction=(t["flow_direction"] or "").lower(),
                air_flow_cm_s=t["air_flow_cm_s"],
                o2_pct_table=t["o2_pct"],
                ignition_power_w=t["ignition_power_w"],
                ignition_time_s=t["ignition_time_s"],
                burn_time_s=t["burn_time_s"],
                ug_burn_length_raw=t["ug_burn_length_raw"] or "",
                g1_burn_length_raw=t["g1_burn_length_raw"] or "",
                ug_spread_raw=t["ug_spread_raw"] or "",
                g1_spread_rate_raw=t["g1_spread_rate_raw"] or "",
                camera1=t["camera1"] or "",
                camera2=t["camera2"] or "",
                ug_burn_cm=ug,
                g1_burn_cm=g1,
                ug_spread=spread(t["ug_spread_raw"]),
                g1_spread=spread(t["g1_spread_rate_raw"]),
                verdict=verdict(t["material"] or "", ug, g1),
                sensors=SensorStats(
                    **{k: v if "epoch" in k else _r(v) for k, v in st.items() if k != "test_id"}
                )
                if st
                else None,
            )
        )
    tracks: dict[str, list[tuple[float, float]]] = {}
    for tid, minutes, co2 in repo.co2_timeline(cur):
        if co2 is not None:
            tracks.setdefault(tid, []).append((round(minutes, 3), round(co2, 4)))
    return Dashboard(
        about=_about(about),
        sample_length_cm=SAMPLE_LENGTH_CM,
        notes=NOTES,
        samples=samples,
        co2_timeline=[Co2Track(test_id=k, points=v) for k, v in tracks.items()],
        documents=[_file(f) for f in repo.study_files(cur)],
    )


def _col(rows: list[tuple], i: int, d: int = 3) -> list[float | None]:
    return [None if r[i] is None else round(float(r[i]), d) for r in rows]


def get_series(cur: DuckDBPyConnection, test_id: str) -> Series | None:
    if not repo.available(cur):
        raise StudyDataMissing
    rows = repo.series(cur, test_id)
    if not rows:
        return None
    cols = repo.SERIES_COLS
    ix = {c: i for i, c in enumerate(cols)}
    cur_i = ix["igniter_current_amps"]
    ign = next((r[0] for r in rows if r[cur_i] is not None and r[cur_i] > 0.5), None)
    t0 = ign if ign is not None else rows[0][0]
    rads, base = [], []
    for c in repo.RADIOMETERS:
        raw = _col(rows, ix[c])
        pre = [v for r, v in zip(rows, raw, strict=True) if v is not None and r[0] < t0]
        b = round(fmean(pre), 3) if pre else None
        base.append(b)
        rads.append([None if v is None or b is None else round(v - b, 3) for v in raw])
    return Series(
        test_id=test_id,
        ignition_t_s=_r(ign),
        t=[round(r[0] - t0, 3) for r in rows],
        sample_tc=[_col(rows, ix[c], 1) for c in repo.SAMPLE_TC],
        plume_tc=[_col(rows, ix[c], 1) for c in repo.PLUME_TC],
        radiometers=rads,
        radiometer_baseline=base,
        co2_pct=_col(rows, ix["co2_pct"], 4),
        o2_pct=_col(rows, ix["o2_pct"], 3),
        igniter_a=_col(rows, cur_i),
        anemometer_1=_col(rows, ix["anemometer_1_cm_sec"], 2),
        anemometer_2=_col(rows, ix["anemometer_2_cm_sec"], 2),
        pressure_psia=_col(rows, ix["ambient_pressure_psia"]),
    )


def _file(f: dict[str, Any]) -> FileItem:
    return FileItem(
        name=re.sub(r"^PSI-99_(Raw Data|Science Documents|Experimental table)_", "", f["name"]),
        category=f["category"] or "",
        kind=f["kind"] or "",
        mb=round(int(f["bytes"] or 0) / 1e6, 2),
    )


def get_sample_files(cur: DuckDBPyConnection, test_id: str) -> SampleFiles:
    rows = repo.sample_files(cur, test_id)
    images = [r for r in rows if r["kind"] == "camera_images_zip"]
    return SampleFiles(
        test_id=test_id,
        files=[_file(r) for r in rows if r["kind"] != "camera_images_zip"],
        image_archives=len(images),
        image_archives_gb=round(sum(int(r["bytes"] or 0) for r in images) / 1e9, 2),
    )
