"""SQL до схеми `bass2` у flame.duckdb. Тільки тут живе SQL; усі значення — параметри."""

import json
from typing import Any

from duckdb import DuckDBPyConnection

TEST_COLS = (
    "test_id", "pi", "test_date", "gmt_day", "sample_no", "material", "flow_restrictor",
    "fan_display", "air_display", "radiometer_gain", "total_frames", "frames_note",
    "o2_initial_pct", "o2_final_pct", "co2_initial_pct", "co2_final_pct", "co_initial_ppm",
    "co_final_ppm", "n_videos",
)  # fmt: skip
FILE_COLS = ("test_id", "kind", "name", "bytes", "version")


def has_study(cur: DuckDBPyConnection) -> bool:
    row = cur.execute("SELECT count(*) FROM studies WHERE slug = ?", ["bass2"]).fetchone()
    return bool(row and row[0])


def get_about(cur: DuckDBPyConnection) -> dict[str, Any] | None:
    row = cur.execute("SELECT about FROM study_about WHERE study = ?", ["bass2"]).fetchone()
    return json.loads(row[0]) if row else None


def list_tests(cur: DuckDBPyConnection) -> list[dict[str, Any]]:
    rows = cur.execute(f"SELECT {', '.join(TEST_COLS)} FROM bass2.tests").fetchall()
    return [dict(zip(TEST_COLS, r, strict=True)) for r in rows]


def get_test(cur: DuckDBPyConnection, test_id: str) -> dict[str, Any] | None:
    row = cur.execute(
        f"SELECT {', '.join(TEST_COLS)} FROM bass2.tests WHERE test_id = ?", [test_id]
    ).fetchone()
    return dict(zip(TEST_COLS, row, strict=True)) if row else None


def list_test_files(cur: DuckDBPyConnection, test_id: str) -> list[dict[str, Any]]:
    rows = cur.execute(
        f"SELECT {', '.join(FILE_COLS)} FROM bass2.test_files WHERE test_id = ? "
        "ORDER BY kind, name",
        [test_id],
    ).fetchall()
    return [dict(zip(FILE_COLS, r, strict=True)) for r in rows]


def same_day(cur: DuckDBPyConnection, test_id: str) -> list[str]:
    rows = cur.execute(
        """
        SELECT t.test_id FROM bass2.tests t
        JOIN bass2.tests me ON me.test_id = ? AND t.test_date = me.test_date
        WHERE t.test_id <> me.test_id ORDER BY t.test_id
        """,
        [test_id],
    ).fetchall()
    return [r[0] for r in rows]
