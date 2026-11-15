"""Дані для графіків агента (make_chart): лише з БД, трансформації — з фіксованого переліку.

- line: одна величина в часі для 1-3 тестів (спільні осі).
- scatter: умови тестів (два числові поля таблиці), групи за типом завершення.
Похідні величини (d², нормування) позначаються `derived`; моделей і фітів тут немає.
"""

from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import duckdb

from flame.core.citations import Source, test_url, timeseries_url
from flame.studies.flex import repository
from flame.studies.flex import service as flex
from flame.studies.flex.fields import FIELDS
from flame.studies.flex.schemas import Filter

STUDY = "PSI-69"
MAX_TESTS = 3
POINTS_PER_SERIES = 300
TONES = ["s1", "s2", "ink"]
END_TONES = {"Extinction": "ext", "Completion": "com", "Disruption": "dis"}


@dataclass(frozen=True)
class Quantity:
    signal: str
    column: str
    label: str
    unit: str
    x: str  # "t" або "t_over_d0sq"
    derived: bool
    transform: str  # none | square | norm_d0_sq


QUANTITIES: dict[str, Quantity] = {
    "droplet_diameter": Quantity("droplet", "d_mm", "droplet diameter d", "mm", "t", False, "none"),
    "droplet_d2": Quantity("droplet", "d_mm", "d²", "mm²", "t", True, "square"),
    "droplet_d2_normalized": Quantity(
        "droplet", "d_mm", "(d/d₀)²", "", "t_over_d0sq", True, "norm_d0_sq"
    ),
    "flame_diameter_uv": Quantity(
        "flame_uv", "flame_d_mm", "flame diameter (UV)", "mm", "t", False, "none"
    ),  # fmt: skip
    "flame_diameter_color": Quantity(
        "flame_color", "flame_d_mm", "flame diameter (color)", "mm", "t", False, "none"
    ),  # fmt: skip
    "standoff_uv": Quantity(
        "flame_uv", "standoff", "flame standoff ratio (UV)", "", "t", False, "none"
    ),  # fmt: skip
}
NUMERIC_FIELDS = [f.name for f in FIELDS.values() if f.type == "number" and f.name != "test_no"]


class ChartError(ValueError):
    pass


def _thin(points: list[list[float]], n: int) -> list[list[float]]:
    if len(points) <= n:
        return points
    step = len(points) / n
    out = [points[int(i * step)] for i in range(n)]
    if out[-1] is not points[-1]:
        out.append(points[-1])
    return out


def _r(v: float) -> float:
    return float(f"{v:.5g}")


def line(cur: duckdb.DuckDBPyConnection, quantity: str, test_nos: list[int]) -> dict[str, Any]:
    q = QUANTITIES.get(quantity)
    if q is None:
        raise ChartError(f"unknown quantity {quantity!r}; one of {list(QUANTITIES)}")
    nos = list(dict.fromkeys(test_nos))
    if not 1 <= len(nos) <= MAX_TESTS:
        raise ChartError(f"a line chart shows 1-{MAX_TESTS} tests")
    rows = {r["test_no"]: r for r in repository.get_tests(cur, nos)}
    series, sources, notes = [], [], []
    for i, n in enumerate(nos):
        row = rows.get(n)
        if row is None:
            raise ChartError(f"{flex.test_name(n)} not found")
        cols, data = repository.timeseries(cur, n, q.signal)
        ci = cols.index(q.column)
        d0 = row.get("d0_mm")
        if q.transform == "norm_d0_sq" and not d0:
            notes.append(f"{flex.test_name(n)}: no initial diameter d0, cannot normalise")
            continue
        pts = []
        for r in data:
            t, v = r[0], r[ci]
            if t is None or v is None or t < 0:
                continue
            x = t / d0**2 if q.x == "t_over_d0sq" else t
            y = (
                v * v
                if q.transform == "square"
                else (v / d0) ** 2
                if q.transform == "norm_d0_sq"
                else v
            )
            pts.append([_r(x), _r(y)])
        if not pts:
            notes.append(f"{flex.test_name(n)}: no {q.signal} series")
            continue
        pts = _thin(pts, POINTS_PER_SERIES)
        name = flex.test_name(n)
        series.append({"id": name, "label": name, "points": pts, "kind": "dots", "tone": TONES[i]})
        ys = [p[1] for p in pts]
        unit = f" {q.unit}" if q.unit else ""
        text = (
            f"{q.label} of {name} ({row.get('fuel')}, {row.get('end_type')}) over "
            f"{'t/d0²' if q.x == 't_over_d0sq' else 'time'}: {len(pts)} plotted samples from "
            f"{pts[0][0]} to {pts[-1][0]} {'s/mm²' if q.x == 't_over_d0sq' else 's'}; "
            f"values from {min(ys)} to {max(ys)}{unit}"
            + (" (derived from the measured droplet diameter)." if q.derived else ".")
        )
        sources.append(
            Source(url=timeseries_url(STUDY, n, q.signal), title=f"{name} {q.label}", text=text)
        )
    if not series:
        raise ChartError("; ".join(notes) or "no data to plot")
    unit = f", {q.unit}" if q.unit else ""
    x_label = "t / d₀², s/mm²" if q.x == "t_over_d0sq" else "time, s"
    names = ", ".join(s["label"] for s in series)
    return {
        "chart": {
            "kind": "line",
            "title": f"{q.label} — {names}",
            "x_label": x_label,
            "y_label": f"{q.label}{unit}",
            "derived": q.derived,
            "series": series,
            "test_nos": [int(s["id"].split("-")[1]) for s in series],
            "notes": notes,
        },
        "sources": sources,
    }


def scatter(
    cur: duckdb.DuckDBPyConnection, filters: list[Filter], x_field: str, y_field: str
) -> dict[str, Any]:
    for f in (x_field, y_field):
        if f not in NUMERIC_FIELDS:
            raise ChartError(f"{f!r} is not a numeric field; one of {NUMERIC_FIELDS}")
    try:
        res = flex.query_tests(cur, filters, "test_no", False, flex.MAX_LIMIT)
    except repository.InvalidFilter as e:
        raise ChartError(str(e)) from e
    groups: dict[str, list[list[float]]] = {}
    for t in res.tests:
        x, y = getattr(t, x_field), getattr(t, y_field)
        if x is None or y is None or t.end_type not in END_TONES:
            continue
        groups.setdefault(t.end_type, []).append([_r(x), _r(y), t.test_no])
    if not groups:
        raise ChartError("no tests with both values match these filters")
    fx, fy = FIELDS[x_field], FIELDS[y_field]
    series = [
        {
            "id": end,
            "label": end,
            "points": [p[:2] for p in pts],
            "kind": "dots",
            "tone": END_TONES[end],
            "test_nos": [int(p[2]) for p in pts],
        }
        for end, pts in groups.items()
    ]
    n = sum(len(s["points"]) for s in series)
    summary = "; ".join(f"{s['label']}: {len(s['points'])} tests" for s in series)
    src = Source(
        url=_query_url(filters),
        title=f"{fy.description} vs {fx.description} (FLEX table)",
        text=(
            f"Scatter of {n} FLEX tests with both values recorded, grouped by how they ended: "
            f"{summary}. Values come from the FLEX experiment table."
        ),
    )
    label = lambda f: f"{f.description}{f', {f.unit}' if f.unit else ''}"  # noqa: E731
    return {
        "chart": {
            "kind": "scatter",
            "title": f"{fy.description} vs {fx.description}",
            "x_label": label(fx),
            "y_label": label(fy),
            "derived": False,
            "series": series,
            "test_nos": [],
            "notes": [],
        },
        "sources": [src],
    }


def _query_url(filters: list[Filter]) -> str:
    parts = [
        f"{f.field}:{f.op}" + (f":{f.value}" if f.value not in (None, "") else "") for f in filters
    ]
    qs = "&".join(f"f={quote(p, safe=':,')}" for p in parts)
    base = test_url(STUDY, 0).rsplit("/", 1)[0]
    return f"{base}?{qs}" if qs else base
