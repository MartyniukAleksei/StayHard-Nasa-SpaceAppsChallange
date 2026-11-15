"""3D-тур агента (show_in_3d): кроки з фіксованих переліків → готовий сценарій для сцени.

Модель обирає момент, ракурс, об'єкт і дію з переліків та пише підпис із заповнювачами
(`{d}`, `{t}` …). Числа підставляє цей модуль із рядів і таблиці тесту, тож модель не може
написати в підписі власне число. Кожен підпис несе теги (`data` / `derived`) і джерело.
Чиста логіка: дані тесту передаються готовими (`TourData`), SQL тут немає.
Рішення — docs/decisions/0010-agent-3d-tour.md, контракт події — docs/agent/ui-actions.md.
"""

import re
from bisect import bisect_left
from dataclasses import dataclass
from typing import Any

import duckdb

from flame.core.citations import Source, media_url, timeseries_url
from flame.studies.flex import repository
from flame.studies.flex import service as flex

STUDY = "PSI-69"
MOMENTS = [
    "needles_retract", "igniter_on", "ignition", "flame_max", "extinction", "end_of_data", "t",
]  # fmt: skip
ACTIONS = ["play", "pause"]
CAMERAS = ["overview", "flame", "droplet", "camera_view"]
FOCUS = ["droplet", "flame_color", "flame_uv", "trail", "needles", "igniters", "frame"]
MAX_STEPS = 6
MAX_LABELS = 2
MAX_TEXT = 90
TOLERANCE_S = 0.25  # найближчий відлік ряду має бути не далі від моменту кроку
SPEED_RANGE = (0.25, 4.0)

# заповнювач → (поле таблиці тесту, формат, одиниця)
TABLE_VALUES = {
    "d0": ("d0_mm", ".2f", "mm"),
    "dext": ("dext_mm", ".2f", "mm"),
    "K": ("k_mm2_s", ".3f", "mm²/s"),
    "burn_time": ("burn_time_s", ".2f", "s"),
}
STEP_VALUES = ["t", "d", "d2", "flame_d", "flame_d_uv"]
BETWEEN_VALUES = ["d_change", "dt"]
PLACEHOLDERS = [*STEP_VALUES, *BETWEEN_VALUES, *TABLE_VALUES]

_PLACEHOLDER = re.compile(r"\{([^{}]*)\}")
# дозволені цифри в тексті підпису: назва тесту, хімічні формули й позначення d0
_ALLOWED_DIGITS = re.compile(r"(?:#|FLEX-)\d+|\b(?:CO2|O2|N2|H2O|d0)\b")
_LOG_MOMENTS = {"needles_retract": "the needles retract", "igniter_on": "the igniter turns on"}

Series = list[tuple[float, float]]


class TourError(ValueError):
    """Помилка в кроках туру: текст повертається моделі, щоб вона виправила виклик."""


@dataclass
class TourData:
    test: dict[str, Any]
    droplet: Series  # (t_s, d_mm)
    flame_color: Series  # (t_s, flame_d_mm)
    flame_uv: Series
    events: dict[str, float | None]  # рухи апаратури з логу, с від запалювання

    @property
    def test_no(self) -> int:
        return int(self.test["test_no"])

    @property
    def name(self) -> str:
        return flex.test_name(self.test_no)


def _pairs(cur: duckdb.DuckDBPyConnection, test_no: int, signal: str, column: str) -> Series:
    cols, rows = repository.timeseries(cur, test_no, signal)
    i = cols.index(column)
    return [(float(r[0]), float(r[i])) for r in rows if r[0] is not None and r[i] is not None]


def load(cur: duckdb.DuckDBPyConnection, test_no: int, events: dict[str, float | None]) -> TourData:
    rows = repository.get_tests(cur, [test_no])
    if not rows:
        raise TourError(f"{flex.test_name(test_no)} not found")
    row = rows[0]
    droplet = _pairs(cur, test_no, "droplet", "d_mm") if row.get("has_droplet_ts") else []
    if not droplet:
        raise TourError(
            f"{flex.test_name(test_no)} has no measured droplet series, so it has no 3D replay"
        )
    color = (
        _pairs(cur, test_no, "flame_color", "flame_d_mm") if row.get("has_flame_color_ts") else []
    )
    uv = _pairs(cur, test_no, "flame_uv", "flame_d_mm") if row.get("has_flame_uv_ts") else []
    return TourData(row, droplet, color, uv, events)


def _flame_series(data: TourData) -> list[tuple[str, Series]]:
    found = [
        (k, s) for k, s in (("flame_uv", data.flame_uv), ("flame_color", data.flame_color)) if s
    ]
    if not found:
        raise TourError(f"{data.name} has no measured flame series for this moment")
    return found


def _flame(data: TourData) -> tuple[str, Series]:
    """Ряд полум'я для `flame_max`: UV, інакше кольоровий."""
    return _flame_series(data)[0]


def time_range(data: TourData) -> tuple[float, float]:
    starts = [data.droplet[0][0], *(v for v in data.events.values() if v is not None)]
    return min(starts), data.droplet[-1][0]


def resolve_moment(data: TourData, moment: str, t_s: float | None = None) -> tuple[float, str, str]:
    """Момент → (секунди від запалювання, тег часу, ключ джерела)."""
    if moment in _LOG_MOMENTS:
        t = data.events.get(moment)
        if t is None:
            raise TourError(
                f"the test log of {data.name} does not record when {_LOG_MOMENTS[moment]}"
            )
        return t, "data", "log"
    if moment == "ignition":
        return 0.0, "data", "log" if data.test.get("cir_id") else "droplet"
    if moment == "flame_max":
        key, series = _flame(data)
        return max(series, key=lambda p: p[1])[0], "derived", key
    if moment == "extinction":
        # останній відлік обох рядів полум'я: після нього в сцені вже немає жодної оболонки
        # (як flameEnd у frontend/.../experiment-3d/lib/experiment.ts)
        ends = [(s[-1][0], k) for k, s in _flame_series(data)]
        t, key = max(ends)
        return t, "derived", key
    if moment == "end_of_data":
        return data.droplet[-1][0], "derived", "droplet"
    if moment == "t":
        lo, hi = time_range(data)
        if t_s is None or not lo <= float(t_s) <= hi:
            raise TourError(
                f"moment 't' needs t_s between {lo:.1f} and {hi:.1f} s (the data of {data.name})"
            )
        return float(t_s), "data", "droplet"
    raise TourError(f"unknown moment {moment!r}; one of {MOMENTS}")


def nearest(series: Series, t: float) -> tuple[float, float] | None:
    """Найближчий відлік ряду не далі ніж TOLERANCE_S від t, інакше None («no measurement»)."""
    if not series:
        return None
    i = bisect_left(series, (t,))
    best = min(series[max(0, i - 1) : i + 1], key=lambda p: abs(p[0] - t))
    return best if abs(best[0] - t) <= TOLERANCE_S else None


def values_at(data: TourData, t: float) -> dict[str, float]:
    """Виміряні значення в момент t: лише ті, для яких є відлік у межах допуску."""
    out: dict[str, float] = {}
    d = nearest(data.droplet, t)
    if d:
        out["d"] = d[1]
        out["d2"] = d[1] ** 2
    for key, series in (("flame_d", data.flame_color), ("flame_d_uv", data.flame_uv)):
        hit = nearest(series, t)
        if hit:
            out[key] = hit[1]
    return out


def fmt_time(t: float) -> str:
    return f"{abs(t):.1f} s before ignition" if t < -0.05 else f"{max(t, 0.0):.1f} s"


_WHAT = {
    "d": "droplet diameter",
    "d2": "droplet d²",
    "flame_d": "color-camera flame diameter",
    "flame_d_uv": "UV-camera flame diameter",
}
_SOURCE_OF = {"d": "droplet", "d2": "droplet", "flame_d": "flame_color", "flame_d_uv": "flame_uv"}
_UNIT = {"d": "mm", "d2": "mm²", "flame_d": "mm", "flame_d_uv": "mm"}


def check_text(text: Any, where: str) -> str:
    """Текст підпису від моделі: лише заповнювачі з переліку, жодних власних чисел."""
    if not isinstance(text, str) or not text.strip():
        raise TourError(f"{where}: label text is empty")
    text = " ".join(text.split())
    if len(text) > MAX_TEXT:
        raise TourError(f"{where}: label text is longer than {MAX_TEXT} characters")
    unknown = [p for p in _PLACEHOLDER.findall(text) if p not in PLACEHOLDERS]
    if unknown:
        raise TourError(f"{where}: unknown placeholder {{{unknown[0]}}}; use one of {PLACEHOLDERS}")
    bare = _ALLOWED_DIGITS.sub("", _PLACEHOLDER.sub("", text))
    if re.search(r"\d", bare) or "{" in bare or "}" in bare:
        raise TourError(
            f"{where}: do not write numbers in label text; use placeholders such as {{d}} or "
            "{t} and the server fills in the measured value"
        )
    return text


@dataclass
class _Step:
    t: float
    t_tag: str
    t_source: str
    values: dict[str, float]


def _fill(text: str, step: _Step, prev: _Step | None, data: TourData, where: str):
    """Підставляє значення → (текст, теги, ключ джерела першого заповнювача)."""
    tags: list[str] = []
    source: str | None = None

    def put(m: re.Match[str]) -> str:
        nonlocal source
        key = m.group(1)
        if key == "t":
            value, tag, src = fmt_time(step.t), step.t_tag, step.t_source
        elif key in _WHAT:
            if key not in step.values:
                raise TourError(
                    f"{where}: no {_WHAT[key]} measurement within {TOLERANCE_S} s of "
                    f"{fmt_time(step.t)}; remove {{{key}}} or choose another moment"
                )
            value = f"{step.values[key]:.2f} {_UNIT[key]}"
            tag, src = ("derived" if key == "d2" else "data"), _SOURCE_OF[key]
        elif key in BETWEEN_VALUES:
            if prev is None:
                raise TourError(
                    f"{where}: {{{key}}} compares with the previous step; step 1 has none"
                )
            if key == "dt":
                value = f"{abs(step.t - prev.t):.1f} s"
            elif "d" not in step.values or "d" not in prev.values:
                raise TourError(
                    f"{where}: {{d_change}} needs a droplet measurement at this step and the "
                    "previous one"
                )
            else:
                value = f"{abs(step.values['d'] - prev.values['d']):.2f} mm"
            tag, src = "derived", "droplet"
        else:
            field, spec, unit = TABLE_VALUES[key]
            raw = data.test.get(field)
            if raw is None:
                raise TourError(f"{where}: {{{key}}} is not recorded in the table for {data.name}")
            value, tag, src = f"{raw:{spec}} {unit}", "data", "table"
        if tag not in tags:
            tags.append(tag)
        source = source or src
        return value

    return _PLACEHOLDER.sub(put, text), tags, source


def _one_of(value: Any, allowed: list[str], what: str, where: str) -> str:
    if value not in allowed:
        raise TourError(f"{where}: {what} must be one of {allowed}, got {value!r}")
    return value


def _summary(data: TourData, steps: list[_Step], key: str) -> str:
    """Текст джерела ряду: значення в кожному кроці туру, щоб відповідь могла їх цитувати."""
    parts = [
        f"step {i} at {fmt_time(s.t)}: {s.values[key]:.2f} {_UNIT[key]}"
        + (f" (d² {s.values['d2']:.2f} mm², derived)" if key == "d" else "")
        for i, s in enumerate(steps, start=1)
        if key in s.values
    ]
    text = (
        f"{_WHAT[key].capitalize()} of {data.name} at the 3D walkthrough steps (nearest measured "
        f"sample within {TOLERANCE_S} s): " + "; ".join(parts) + "."
    )
    if key == "d":
        for i in range(1, len(steps)):
            a, b = steps[i - 1], steps[i]
            if "d" in a.values and "d" in b.values:
                diff = b.values["d"] - a.values["d"]
                word = "decreased" if diff <= 0 else "increased"
                text += (
                    f" Between step {i} and step {i + 1} ({abs(b.t - a.t):.1f} s) the droplet "
                    f"diameter {word} by {abs(diff):.2f} mm (derived from the two samples)."
                )
    return text


def build(data: TourData, raw_steps: Any) -> dict[str, Any]:
    """Кроки від моделі → {test_no, steps, sources}: `steps` для події `tour`, `sources` — Source.

    У підписі `source` — індекс у `sources` (None, якщо в тексті немає значень з даних).
    """
    if not isinstance(raw_steps, list) or not 1 <= len(raw_steps) <= MAX_STEPS:
        raise TourError(f"a walkthrough has 1-{MAX_STEPS} steps")
    resolved: list[_Step] = []
    out_steps: list[dict[str, Any]] = []
    for i, raw in enumerate(raw_steps, start=1):
        where = f"step {i}"
        if not isinstance(raw, dict):
            raise TourError(f"{where}: must be an object")
        moment = _one_of(raw.get("moment"), MOMENTS, "moment", where)
        t, t_tag, t_source = resolve_moment(data, moment, raw.get("t_s"))
        step = _Step(t, t_tag, t_source, values_at(data, t))
        prev = resolved[-1] if resolved else None
        action = _one_of(raw.get("action") or "pause", ACTIONS, "action", where)
        camera = _one_of(raw.get("camera") or "overview", CAMERAS, "camera", where)
        focus = [_one_of(f, FOCUS, "focus", where) for f in raw.get("focus") or []]
        raw_labels = raw.get("labels") or []
        if not isinstance(raw_labels, list) or len(raw_labels) > MAX_LABELS:
            raise TourError(f"{where}: at most {MAX_LABELS} labels per step")
        labels = []
        for raw_label in raw_labels:
            if not isinstance(raw_label, dict):
                raise TourError(f"{where}: each label is an object with 'at' and 'text'")
            at = _one_of(raw_label.get("at") or "droplet", FOCUS, "label 'at'", where)
            text = check_text(raw_label.get("text"), where)
            filled, tags, source = _fill(text, step, prev, data, where)
            labels.append({"at": at, "text": filled, "tags": tags, "source": source})
        try:
            speed = float(raw.get("speed") or 1)
        except (TypeError, ValueError):
            raise TourError(f"{where}: speed must be a number") from None
        resolved.append(step)
        out_steps.append(
            {
                "moment": moment,
                "t": round(t, 3),
                "action": action,
                "speed": min(SPEED_RANGE[1], max(SPEED_RANGE[0], speed)),
                "camera": camera,
                "focus": list(dict.fromkeys(focus)),
                "show_frame": bool(raw.get("show_frame")),
                "labels": labels,
            }
        )

    n = data.test_no
    sources: dict[str, Source] = {}
    for key, signal in _SOURCE_OF.items():
        if key != "d2" and any(key in s.values for s in resolved):
            sources[signal] = Source(
                url=timeseries_url(STUDY, n, signal),
                title=f"{data.name} {signal} time series — values at the walkthrough steps",
                text=_summary(data, resolved, key),
            )
    used = {lb["source"] for st in out_steps for lb in st["labels"]} | {
        s.t_source for s in resolved
    }
    if "table" in used:
        sources["table"] = flex.test_source(data.test)
    if "log" in used and data.test.get("cir_id"):
        moments = "; ".join(
            f"step {i} ({st['moment'].replace('_', ' ')}) at {fmt_time(s.t)}"
            for i, (st, s) in enumerate(zip(out_steps, resolved, strict=True), start=1)
            if s.t_source == "log"
        )
        sources["log"] = Source(
            url=media_url(STUDY, f"raw/{n:03d}/{data.test['cir_id']}.txt"),
            title=f"{data.name} test log — hardware timing",
            text=(
                f"Times in the walkthrough of {data.name} count from ignition (the 'AS Igniter "
                f"Off/Retract Start' line of the test log). {moments}."
            ),
        )
    order = list(sources)
    for st in out_steps:
        for lb in st["labels"]:
            lb["source"] = order.index(lb["source"]) if lb["source"] in sources else None
    return {"test_no": n, "steps": out_steps, "sources": list(sources.values())}
