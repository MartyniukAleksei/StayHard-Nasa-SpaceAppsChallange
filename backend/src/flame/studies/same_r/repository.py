"""Читання SAME-R (PSI-101) зі схеми `samer` у flame.duckdb (flame.ingest.psi_studies) і файлів
знімка `$DATA_DIR/samer` (docs/, raw/). Колонки перейменовуються на ті, що віддає API, дані не
змінюються; що знімок зберігає як службові коди, перетворюється на NULL (див. `_HKP`).
"""

import json
import re
import zipfile
from functools import lru_cache
from pathlib import Path
from typing import Any

from duckdb import DuckDBPyConnection

from flame.core.config import settings

SLUG = "samer"
DETECTORS = ("iss_obscuration_v", "iss_scatter_v", "sts_v", "ion_a_v", "ion_b_v")
# детектор «активний», якщо сигнал за тест змінився хоча б на стільки (docs/data/same_r.md §4)
ACTIVE_V = 0.1
PHOTOS_ZIP = "Engineering Documents_SAME-R Flight Ops photos.zip"


def study_dir() -> Path:
    return settings.study_dir(SLUG)


def available(cur: DuckDBPyConnection) -> bool:
    q = (
        "SELECT count(*) FROM information_schema.tables"
        " WHERE table_schema = ? AND table_name = 'tests'"
    )
    return cur.execute(q, [SLUG]).fetchone()[0] > 0


def _rows(
    cur: DuckDBPyConnection, sql: str, params: list[Any] | None = None
) -> list[dict[str, Any]]:
    res = cur.execute(sql, params or [])
    cols = [d[0] for d in res.description]
    return [dict(zip(cols, r, strict=True)) for r in res.fetchall()]


_TESTS = """
SELECT test_id, run_no AS test_no, sample_type AS material, description,
       strftime(test_date, '%-d-%b') AS date_2010, inlet_velocity_cm_s, rt_r0 AS heater_rt_r0,
       duration_s AS heating_s, primary_aging_s, primary_mixing_s, net_aging_s,
       coalesce(has_sensors_ts, false) AS has_timeseries
FROM samer.tests
"""


def tests(cur: DuckDBPyConnection, test_no: int | None = None) -> list[dict[str, Any]]:
    """Рядки таблиці експерименту: `N` і, якщо є, `Na` (той самий дим після витримки)."""
    where = "WHERE run_no = ?" if test_no is not None else ""
    params = [test_no] if test_no is not None else []
    return _rows(cur, f"{_TESTS} {where} ORDER BY run_no, aged_repeat, test_id", params)


# t_s у знімку йде від першого рядка файлу; API відраховує від першого рядка з heating = 1.
# DustTrak пише коди стану (10010, 20008 …) замість мг/м³, P-Trak — -999, коли не міряє:
# це не числа.
_T0 = """
t0 AS (SELECT run_no, coalesce(min(t_s) FILTER (WHERE heating >= 0.5), min(t_s)) AS t0
       FROM samer.ts_sensors {where} GROUP BY run_no)
"""
_HKP = """
SELECT s.t_s - t0.t0 AS t_s, heating, sample_resistance_ohm AS sample_ohm, plume_t_c AS plume_c,
       CASE WHEN ptrak_pt_cc >= 0 THEN ptrak_pt_cc END AS ptrak_per_cc,
       CASE WHEN dusttrak_a_mg_m3 < 1000 THEN dusttrak_a_mg_m3 END AS dusttrak_a_mg_m3,
       CASE WHEN dusttrak_b_mg_m3 < 1000 THEN dusttrak_b_mg_m3 END AS dusttrak_b_mg_m3,
       iss_obscuration_v, iss_scatter_v, sts_v, ion_a_v, ion_b_v
FROM samer.ts_sensors s JOIN t0 USING (run_no)
WHERE s.run_no = ?
ORDER BY s.t_s
"""


def hkp(cur: DuckDBPyConnection, test_no: int) -> tuple[list[str], list[list[Any]]] | None:
    """1 Гц телеметрія прогону. None, якщо ряду немає."""
    res = cur.execute(f"WITH {_T0.format(where='WHERE run_no = ?')} {_HKP}", [test_no, test_no])
    cols = [d[0] for d in res.description]
    rows = [list(r) for r in res.fetchall()]
    return (cols, rows) if rows else None


def coverage(cur: DuckDBPyConnection, test_no: int | None = None) -> dict[int, dict[str, Any]]:
    """Покриття телеметрії на прогін: діапазон t_s, тривалість нагріву, пік P-Trak,
    активні детектори.
    Обчислюється з ts_sensors тими самими правилами, що й `hkp` (похідне, не з таблиці NASA)."""
    where = "WHERE run_no = ?" if test_no is not None else ""
    active = ", ".join(f"max({d}) - min({d}) >= {ACTIVE_V} AS {d}" for d in DETECTORS)
    sql = f"""
    WITH {_T0.format(where=where)},
    s AS (SELECT s.*, s.t_s - t0.t0 AS t, CASE WHEN ptrak_pt_cc >= 0 THEN ptrak_pt_cc END AS p
          FROM samer.ts_sensors s JOIN t0 USING (run_no))
    SELECT run_no, min(t) AS t_min, max(t) AS t_max, count(*) AS rows,
           count(*) FILTER (WHERE heating >= 0.5) AS heating_s,
           max(p) AS ptrak_peak_per_cc, arg_max(t, p) AS ptrak_peak_t_s, {active}
    FROM s GROUP BY run_no
    """
    out = {}
    for r in _rows(cur, sql, [test_no] if test_no is not None else []):
        r["active_detectors"] = [d for d in DETECTORS if r.pop(d)]
        if not r["ptrak_peak_per_cc"]:
            r["ptrak_peak_per_cc"] = r["ptrak_peak_t_s"] = None
        out[r.pop("run_no")] = r
    return out


def test_files(cur: DuckDBPyConnection, test_no: int) -> list[dict[str, Any]]:
    """Усі файли прогону в PSI (у т.ч. для рядка `Na`), без zip з ТЕМ-знімками."""
    sql = """
    SELECT f.name, f.kind, f.category, CAST(f.bytes AS BIGINT) AS bytes, f.version
    FROM samer.test_files f JOIN samer.tests t USING (test_id)
    WHERE t.run_no = ? AND f.kind <> 'archive_zip'
    ORDER BY f.kind, f.name
    """
    return _rows(cur, sql, [test_no])


_SAMPLE = re.compile(r"\b(\d+)\s?([KLPST])\b")


def tem_ref(name: str) -> dict[str, str | None]:
    """Ім'я zip з ТЕМ-знімками → ID зразка (напр. 26K) і pre/post-age, якщо вони є в імені."""
    sample = _SAMPLE.search(name)
    low = name.lower()
    aging = "pre" if "preage" in low or "pre-age" in low else None
    aging = aging or ("post" if re.search(r"post ?-?age", low) else None)
    return {"sample_id": "".join(sample.groups()) if sample else None, "aging": aging}


def tem_archives(cur: DuckDBPyConnection, test_no: int | None = None) -> list[dict[str, Any]]:
    """zip з ТЕМ-знімками частинок, прив'язані до прогону (match = run_name); качаються з PSI."""
    sql = """
    SELECT t.run_no AS test, f.name, f.version, CAST(f.bytes AS BIGINT) AS bytes
    FROM samer.test_files f JOIN samer.tests t USING (test_id)
    WHERE f.kind = 'archive_zip' AND f.match = 'run_name' {and_run}
    ORDER BY f.name
    """
    and_run = "AND t.run_no = ?" if test_no is not None else ""
    rows = _rows(cur, sql.format(and_run=and_run), [test_no] if test_no is not None else [])
    return [{**r, **tem_ref(r["name"])} for r in rows]


def psi_file(cur: DuckDBPyConnection, name: str) -> dict[str, Any] | None:
    """Файл PSI-101 з переліку знімка; інших імен API не віддає (захист редиректу)."""
    rows = _rows(
        cur,
        "SELECT name, version, CAST(bytes AS BIGINT) AS bytes FROM samer.test_files WHERE name = ?",
        [name],
    )
    return rows[0] if rows else None


def about(cur: DuckDBPyConnection) -> dict[str, Any]:
    row = cur.execute("SELECT about FROM study_about WHERE study = ?", [SLUG]).fetchone()
    return json.loads(row[0]) if row else {}


# --- файли знімка на диску ---------------------------------------------------------------


def local_file(test_no: int, category: str, psi_name: str) -> Path | None:
    """Локальна копія файлу PSI, якщо знімок її містить:
    `raw/<прогін>/<ім'я без PSI-101_<категорія>_>`
    (файли прогону) або `docs/<категорія>/<ім'я без PSI-101_>` (документи)."""
    short = psi_name.removeprefix("PSI-101_")
    for p in (
        study_dir() / "raw" / str(test_no) / short.removeprefix(f"{category}_"),
        study_dir() / "docs" / category / short,
    ):
        if p.is_file():
            return p
    return None


def documents() -> list[dict[str, Any]]:
    """NASA-документи дослідження зі знімка (docs/<категорія>/), згруповані за теками PSI."""
    docs = study_dir() / "docs"
    if not docs.is_dir():
        return []
    groups = []
    for cat in sorted(p for p in docs.iterdir() if p.is_dir()):
        files = [
            {
                "name": f.name,
                "title": f.name.removeprefix(f"{cat.name}_").rsplit(".", 1)[0],
                "path": f.relative_to(study_dir()).as_posix(),
                "bytes": f.stat().st_size,
                "category": cat.name,
            }
            for f in sorted(cat.iterdir())
            if f.is_file() and not f.name.startswith(".") and not f.name.endswith(".zip")
        ]
        if files:
            groups.append({"category": cat.name, "files": files})
    return groups


def photos_zip() -> Path:
    return study_dir() / "docs" / "Engineering Documents" / PHOTOS_ZIP


@lru_cache(maxsize=1)
def _zip_names(path: str, mtime: float) -> tuple[str, ...]:
    with zipfile.ZipFile(path) as z:
        return tuple(z.namelist())


def photo_members() -> list[str]:
    """Фото з МКС у zip знімка: iss023/iss024 — SAME-R (2010); ISS015 — перший політ SAME (2007)."""
    p = photos_zip()
    if not p.is_file():
        return []
    names = _zip_names(str(p), p.stat().st_mtime)
    return sorted(
        m
        for m in names
        if m.rsplit("/", 1)[-1].lower().startswith(("iss023", "iss024"))
        # iss023e040116 — портрет космонавта, у сітці 3:2 дає чорні поля
        and m.rsplit("/", 1)[-1].lower() != "iss023e040116.jpg"
        and m.lower().endswith((".jpg", ".jpe", ".jpeg"))
    )


def read_photo(member: str) -> bytes:
    with zipfile.ZipFile(photos_zip()) as z:  # окремий хендл на читання: ZipFile не потокобезпечний
        return z.read(member)
