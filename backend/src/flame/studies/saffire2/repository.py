"""SQL до flame.duckdb для Saffire-II. Тільки тут живе SQL; значення — параметри."""

import json
from typing import Any

from duckdb import DuckDBPyConnection

STUDY = "saffire2"
SAMPLE_TC = [f"sample_temp_{i}_tc{i + 6}_degrees_c" for i in range(1, 7)]
PLUME_TC = [f"plume_temp_{i}_tc{i}_degrees_c" for i in range(1, 7)]
RADIOMETERS = [f"radiometer_{i}_mw_cm2" for i in range(1, 5)]
SERIES_COLS = [
    "t_s",
    *SAMPLE_TC,
    *PLUME_TC,
    *RADIOMETERS,
    "co2_pct",
    "o2_pct",
    "igniter_current_amps",
    "anemometer_1_cm_sec",
    "anemometer_2_cm_sec",
    "ambient_pressure_psia",
]


def _rows(cur: DuckDBPyConnection, sql: str, params: list | None = None) -> list[dict[str, Any]]:
    res = cur.execute(sql, params or [])
    cols = [d[0] for d in res.description]
    return [dict(zip(cols, r, strict=True)) for r in res.fetchall()]


def available(cur: DuckDBPyConnection) -> bool:
    n = cur.execute(
        "SELECT count(*) FROM information_schema.tables"
        " WHERE table_schema = ? AND table_name IN ('tests', 'ts_sensors')",
        [STUDY],
    ).fetchone()[0]
    return n == 2


def get_about(cur: DuckDBPyConnection) -> dict[str, Any] | None:
    row = cur.execute("SELECT about FROM study_about WHERE study = ?", [STUDY]).fetchone()
    return json.loads(row[0]) if row else None


def list_tests(cur: DuckDBPyConnection) -> list[dict[str, Any]]:
    return _rows(cur, "SELECT * FROM saffire2.tests ORDER BY test_id")


def sensor_stats(cur: DuckDBPyConnection) -> list[dict[str, Any]]:
    """Агрегати по зразку. Запалювання — перший відлік зі струмом запальника > 0.5 А."""
    peak_s = ", ".join(f"max({c})" for c in SAMPLE_TC)
    peak_p = ", ".join(f"max({c})" for c in PLUME_TC)
    rad = " , ".join(f"max({c}) - avg({c}) FILTER (WHERE t_s < ign)" for c in RADIOMETERS)
    sql = f"""
    WITH s AS (
        SELECT *, min(t_s) FILTER (WHERE igniter_current_amps > 0.5)
                  OVER (PARTITION BY test_id) AS ign
        FROM saffire2.ts_sensors
    )
    SELECT test_id,
           min(epoch_time) AS epoch_start_ms,
           max(epoch_time) AS epoch_end_ms,
           min(epoch_time) FILTER (WHERE igniter_current_amps > 0.5) AS ignition_epoch_ms,
           max(t_s) - min(t_s) AS duration_s,
           any_value(ign) AS ignition_t_s,
           max(t_s) FILTER (WHERE igniter_current_amps > 0.5)
             - min(t_s) FILTER (WHERE igniter_current_amps > 0.5) AS igniter_on_s,
           greatest({peak_s}) AS peak_sample_t_c,
           greatest({peak_p}) AS peak_plume_t_c,
           avg(co2_pct) FILTER (WHERE t_s < ign) AS co2_start_pct,
           max(co2_pct) - avg(co2_pct) FILTER (WHERE t_s < ign) AS co2_rise_pct,
           avg(o2_pct) AS o2_mean_pct,
           avg(anemometer_1_cm_sec) AS flow_mean_cm_s,
           stddev_samp(anemometer_1_cm_sec) AS flow_sd_cm_s,
           avg(average_fan_speed_rpm) AS fan_rpm_mean,
           avg(ambient_pressure_psia) AS pressure_mean_psia,
           avg(humidity_pct) AS humidity_mean_pct,
           avg(test_section_inlet_temp_degrees_c) AS inlet_t_mean_c,
           greatest({rad}) AS radiometer_peak_mw_cm2
    FROM s GROUP BY test_id ORDER BY test_id
    """
    return _rows(cur, sql)


def series(cur: DuckDBPyConnection, test_id: str) -> list[tuple]:
    cols = ", ".join(SERIES_COLS)
    return cur.execute(
        f"SELECT {cols} FROM saffire2.ts_sensors WHERE test_id = ? ORDER BY t_s", [test_id]
    ).fetchall()


def co2_timeline(cur: DuckDBPyConnection, step: int = 5) -> list[tuple]:
    """CO₂ модуля через усю серію: (test_id, хвилини від першого відліку серії, co2_pct)."""
    return cur.execute(
        """
        SELECT test_id, (epoch_time - min(epoch_time) OVER ()) / 60000.0, co2_pct
        FROM (SELECT *, row_number() OVER (PARTITION BY test_id ORDER BY t_s) AS rn
              FROM saffire2.ts_sensors)
        WHERE rn % ? = 1
        ORDER BY epoch_time
        """,
        [step],
    ).fetchall()


def study_files(cur: DuckDBPyConnection) -> list[dict[str, Any]]:
    """Документи без прив'язки до зразка (Readme, статті, акти), без архівів кадрів."""
    return _rows(
        cur,
        "SELECT name, category, kind, bytes FROM saffire2.test_files "
        "WHERE test_id IS NULL AND kind <> 'camera_images_zip' ORDER BY category, name",
    )


def sample_files(cur: DuckDBPyConnection, test_id: str) -> list[dict[str, Any]]:
    return _rows(
        cur,
        "SELECT name, category, kind, bytes FROM saffire2.test_files WHERE test_id = ? "
        "ORDER BY kind, name",
        [test_id],
    )
