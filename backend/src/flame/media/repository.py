"""SQL до flame.duckdb: де в PSI лежать архіви кадрів тесту (таблиця test_files)."""

from dataclasses import dataclass

from duckdb import DuckDBPyConnection


@dataclass(frozen=True)
class CameraArchive:
    camera: str
    name: str  # ім'я файлу в PSI
    version: str
    bytes: int


def camera_archives(cur: DuckDBPyConnection, test_no: int) -> list[CameraArchive]:
    rows = cur.execute(
        """
        SELECT camera, name, version, CAST(bytes AS BIGINT)
        FROM test_files
        WHERE kind = 'camera_images_zip' AND TRY_CAST(test_no AS INTEGER) = ?
        ORDER BY camera, name
        """,
        [test_no],
    ).fetchall()
    return [CameraArchive(*r) for r in rows]


def test_exists(cur: DuckDBPyConnection, test_no: int) -> bool:
    return cur.execute("SELECT 1 FROM tests WHERE test_no = ?", [test_no]).fetchone() is not None
