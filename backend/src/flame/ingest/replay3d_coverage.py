"""Звіт: у яких тестів FLEX є дані для 3D replay (frontend/src/features/experiment-3d).

    uv run python -m flame.ingest.replay3d_coverage            # підсумок + таблиця всіх тестів
    uv run python -m flame.ingest.replay3d_coverage --missing  # лише тести без 3D

3D replay будується з ряду діаметра краплі (без нього сцені нічого показувати); ряди полум'я
(UV, колір) і лог тесту `<cir_id>.txt` (нуль часу, голки, запальник) — необов'язкові, без них
сцена бідніша. Скрипт лише читає flame.duckdb і data/flex/raw; у API не імпортується.
"""

import argparse
import sys
from dataclasses import dataclass

import duckdb

from flame.core.config import settings


@dataclass(frozen=True)
class Coverage:
    test_no: int
    droplet: bool
    flame_uv: bool
    flame_color: bool
    log: bool

    @property
    def has_3d(self) -> bool:
        return self.droplet

    @property
    def verdict(self) -> str:
        if not self.droplet:
            return "no 3D: no droplet series"
        if not (self.flame_uv or self.flame_color):
            return "3D, droplet only (no flame series)"
        return "3D" if self.log else "3D, no test log (no needle/igniter timing)"


def collect() -> list[Coverage]:
    with duckdb.connect(str(settings.duckdb_path), read_only=True) as con:
        rows = con.execute(
            """
            SELECT test_no, cir_id, coalesce(has_droplet_ts, false),
                   coalesce(has_flame_uv_ts, false), coalesce(has_flame_color_ts, false)
            FROM tests ORDER BY test_no
            """
        ).fetchall()
    raw = settings.flex_dir / "raw"
    return [
        Coverage(
            test_no=n,
            droplet=d,
            flame_uv=uv,
            flame_color=col,
            log=bool(cir) and (raw / f"{n:03d}" / f"{cir}.txt").is_file(),
        )
        for n, cir, d, uv, col in rows
    ]


def _yes(v: bool) -> str:
    return "yes" if v else "—"


def render(items: list[Coverage], missing_only: bool) -> str:
    total = len(items)
    with_3d = sum(c.has_3d for c in items)
    lines = [
        f"3D replay: {with_3d} of {total} tests have the data, {total - with_3d} do not.",
        "",
        "| Test | Droplet | Flame UV | Flame color | Test log | 3D replay |",
        "|---:|:---:|:---:|:---:|:---:|---|",
    ]
    for c in items:
        if missing_only and c.has_3d:
            continue
        lines.append(
            f"| {c.test_no} | {_yes(c.droplet)} | {_yes(c.flame_uv)} | {_yes(c.flame_color)} "
            f"| {_yes(c.log)} | {c.verdict} |"
        )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--missing", action="store_true", help="лише тести без 3D")
    args = parser.parse_args()
    if not settings.duckdb_path.exists():
        raise SystemExit(
            f"Немає {settings.duckdb_path}. Спершу: uv run python -m flame.ingest.build_db"
        )
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    print(render(collect(), args.missing))


if __name__ == "__main__":
    main()
