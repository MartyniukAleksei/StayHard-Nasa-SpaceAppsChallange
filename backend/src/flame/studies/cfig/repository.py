"""SQL до схеми `cfig` у flame.duckdb. Тільки тут живе SQL; усі значення — параметри."""

import json
from typing import Any

from duckdb import DuckDBPyConnection

STUDY = "cfig"

_COLUMNS = (
    "test_id, flame_type, fuel, p_bar, x_o2, x_o2_after, fuel_flow_mg_s, tad_k, zst, "
    "hot_ignition, burn_time_s, end_mode, peak_burner_t_c, cool_flame_note, comment, "
    "has_telemetry_ts"
)


def is_loaded(cur: DuckDBPyConnection) -> bool:
    row = cur.execute(
        "SELECT count(*) FROM information_schema.tables"
        " WHERE table_schema = ? AND table_name = 'tests'",
        [STUDY],
    ).fetchone()
    return bool(row and row[0])


def get_about(cur: DuckDBPyConnection) -> dict[str, Any] | None:
    row = cur.execute("SELECT about FROM study_about WHERE study = ?", [STUDY]).fetchone()
    return json.loads(row[0]) if row else None


def list_tests(cur: DuckDBPyConnection) -> list[dict[str, Any]]:
    cur.execute(f"SELECT {_COLUMNS} FROM cfig.tests ORDER BY test_id")
    names = [d[0] for d in cur.description]
    return [dict(zip(names, row, strict=True)) for row in cur.fetchall()]
