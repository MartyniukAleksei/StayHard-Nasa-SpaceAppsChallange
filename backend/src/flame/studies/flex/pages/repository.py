"""SQL до flame.duckdb для FLEX. Тільки тут живе SQL; усі значення — параметри.

Умови груп пресетів — константи коду (не вхід користувача), тому підставляються у WHERE
як фрагменти. Вільна крапля = ts_fiber = false; тести з ниткою і з невідомим статусом нитки
рахуються окремо й не змішуються з вільними (доменне правило).
"""

import json
from typing import Any

from duckdb import DuckDBPyConnection

COOL_FLAME_PATTERN = "cool[- ]?flame"  # похідний прапорець з коментаря дослідника

GROUP_WHERE: dict[str, str] = {
    "iss_air": "diluent = 'N2' AND abs(x_o2 - 0.21) < 0.006 AND p_atm > 0.9 AND p_atm < 1.1",
    "lunar": "p_atm < 0.85 AND x_o2 >= 0.30",
    "co2": "diluent = 'CO2'",
    "he": "diluent = 'He'",
    "cool_flames": f"regexp_matches(lower(ts_comment), '{COOL_FLAME_PATTERN}')",
    "clean_d2": (
        "ts_fiber = false AND end_type <> 'Disruption' AND has_droplet_ts AND has_flame_uv_ts"
    ),
    "methanol": "fuel = 'Methanol'",
    "heptane": "fuel = 'Heptane'",
}

_FREE = "ts_fiber = false"


def get_about(cur: DuckDBPyConnection, study: str) -> dict[str, Any] | None:
    row = cur.execute("SELECT about FROM study_about WHERE study = ?", [study]).fetchone()
    return json.loads(row[0]) if row else None


def get_facts(cur: DuckDBPyConnection) -> dict[str, Any]:
    n, first, last = cur.execute(
        "SELECT count(*), min(year(test_date)), max(year(test_date)) FROM tests"
    ).fetchone()
    fuels = [r[0] for r in cur.execute("SELECT DISTINCT fuel FROM tests ORDER BY 1").fetchall()]
    diluents = [
        r[0] for r in cur.execute("SELECT DISTINCT diluent FROM tests ORDER BY 1").fetchall()
    ]
    return {
        "n_tests": n,
        "fuels": fuels,
        "diluents": diluents,
        "first_year": first,
        "last_year": last,
    }


def count_group(cur: DuckDBPyConnection, group_id: str) -> dict[str, int]:
    """Розклад за фіналами для вільних крапель + скільки тестів виключено через нитку."""
    where = GROUP_WHERE[group_id]
    row = cur.execute(
        f"""
        SELECT
          count(*) FILTER (WHERE {_FREE}),
          count(*) FILTER (WHERE {_FREE} AND end_type = ?),
          count(*) FILTER (WHERE {_FREE} AND end_type = ?),
          count(*) FILTER (WHERE {_FREE} AND end_type = ?),
          count(*) FILTER (WHERE ts_fiber = true),
          count(*) FILTER (WHERE ts_fiber IS NULL)
        FROM tests WHERE {where}
        """,
        ["Extinction", "Completion", "Disruption"],
    ).fetchone()
    keys = ("total", "extinction", "completion", "disruption", "fiber", "fiber_unknown")
    return dict(zip(keys, row, strict=True))


def get_test_header(cur: DuckDBPyConnection, test_no: int) -> dict[str, Any] | None:
    row = cur.execute(
        "SELECT test_no, fuel, end_type, burn_time_s, d0_mm FROM tests WHERE test_no = ?",
        [test_no],
    ).fetchone()
    if row is None:
        return None
    return dict(zip(("test_no", "fuel", "end_type", "burn_time_s", "d0_mm"), row, strict=True))


def get_droplet_series(cur: DuckDBPyConnection, test_no: int) -> list[tuple[float, float]]:
    return cur.execute(
        "SELECT t_s, d_mm FROM ts_droplet WHERE test_no = ? AND t_s >= 0 AND d_mm IS NOT NULL "
        "ORDER BY t_s",
        [test_no],
    ).fetchall()


def get_flame_series(cur: DuckDBPyConnection, test_no: int) -> list[tuple[float, float]]:
    return cur.execute(
        "SELECT t_s, flame_d_mm FROM ts_flame_uv "
        "WHERE test_no = ? AND t_s >= 0 AND flame_d_mm IS NOT NULL ORDER BY t_s",
        [test_no],
    ).fetchall()


def get_standoff_series(cur: DuckDBPyConnection, test_no: int) -> list[tuple[float, float]]:
    return cur.execute(
        "SELECT t_s, standoff FROM ts_flame_uv "
        "WHERE test_no = ? AND t_s >= 0 AND standoff IS NOT NULL ORDER BY t_s",
        [test_no],
    ).fetchall()


def get_full_series(cur: DuckDBPyConnection, test_no: int) -> list[tuple[str, float, float]]:
    """Усі виміряні точки тесту в довгому форматі (signal, t_s, value) — для CSV."""
    return cur.execute(
        """
        SELECT 'droplet_d_mm', t_s, d_mm FROM ts_droplet WHERE test_no = ? AND d_mm IS NOT NULL
        UNION ALL
        SELECT 'flame_d_mm', t_s, flame_d_mm FROM ts_flame_uv
          WHERE test_no = ? AND flame_d_mm IS NOT NULL
        UNION ALL
        SELECT 'standoff', t_s, standoff FROM ts_flame_uv WHERE test_no = ? AND standoff IS NOT NULL
        ORDER BY 1, 2
        """,
        [test_no, test_no, test_no],
    ).fetchall()


SUMMARY_COLUMNS = (
    "test_no", "fuel", "p_atm", "x_o2", "diluent", "d0_mm", "dext_mm", "k_mm2_s",
    "burn_time_s", "end_type", "ts_fiber", "has_series", "has_3d", "cool_flame",
)  # fmt: skip


def list_tests(cur: DuckDBPyConnection) -> list[dict[str, Any]]:
    rows = cur.execute(
        f"""
        SELECT test_no, fuel, p_atm, x_o2, diluent, d0_mm, dext_mm, k_mm2_s, burn_time_s,
               end_type, ts_fiber,
               coalesce(has_droplet_ts AND has_flame_uv_ts, false) AS has_series,
               coalesce(has_droplet_ts, false) AS has_3d,
               coalesce(regexp_matches(lower(ts_comment), '{COOL_FLAME_PATTERN}'), false)
        FROM tests ORDER BY test_no
        """
    ).fetchall()
    return [dict(zip(SUMMARY_COLUMNS, r, strict=True)) for r in rows]


def get_test(cur: DuckDBPyConnection, test_no: int) -> dict[str, Any] | None:
    cur.execute("SELECT * FROM tests WHERE test_no = ?", [test_no])
    row = cur.fetchone()
    if row is None:
        return None
    cols = [d[0] for d in cur.description]
    return dict(zip(cols, row, strict=True))


def find_neighbors(cur: DuckDBPyConnection, test_no: int, limit: int) -> list[dict[str, Any]]:
    """Найближчі тести: те саме паливо, розбавник і клас нитки; відстань за O₂, тиском і d₀,
    нормована на стандартне відхилення по всіх тестах. Відсутній d₀ дає штраф 1 σ."""
    rows = cur.execute(
        """
        WITH sd AS (
          SELECT stddev_pop(x_o2) AS so2, stddev_pop(p_atm) AS sp, stddev_pop(d0_mm) AS sd0
          FROM tests
        ), me AS (SELECT * FROM tests WHERE test_no = ?)
        SELECT t.test_no, t.fuel, t.p_atm, t.x_o2, t.diluent, t.d0_mm, t.end_type,
          sqrt(
            power((t.x_o2 - me.x_o2) / sd.so2, 2)
            + power((t.p_atm - me.p_atm) / sd.sp, 2)
            + power(coalesce((t.d0_mm - me.d0_mm) / sd.sd0, 1), 2)
          ) AS distance
        FROM tests t, me, sd
        WHERE t.test_no <> me.test_no
          AND t.fuel = me.fuel AND t.diluent = me.diluent
          AND t.ts_fiber IS NOT DISTINCT FROM me.ts_fiber
        ORDER BY distance, t.test_no
        LIMIT ?
        """,
        [test_no, limit],
    ).fetchall()
    keys = ("test_no", "fuel", "p_atm", "x_o2", "diluent", "d0_mm", "end_type", "distance")
    return [dict(zip(keys, r, strict=True)) for r in rows]


def get_limitations(cur: DuckDBPyConnection) -> dict[str, int]:
    row = cur.execute(
        """
        SELECT
          count(*) FILTER (WHERE ts_fiber = true),
          count(*) FILTER (WHERE ts_fiber = false),
          count(*) FILTER (WHERE ts_fiber IS NULL),
          count(*) FILTER (WHERE end_type = 'Disruption'),
          count(*) FILTER (WHERE d0_mm IS NULL),
          count(*) FILTER (WHERE k_mm2_s IS NULL),
          count(*) FILTER (WHERE NOT coalesce(has_droplet_ts, false)),
          count(*)
        FROM tests
        """
    ).fetchone()
    keys = ("fiber", "free", "fiber_unknown", "disruption", "missing_d0", "missing_k",
            "without_series", "total")  # fmt: skip
    return dict(zip(keys, row, strict=True))
