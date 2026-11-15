"""Час кадрів камер у секундах від запалювання (як t_s у таблицях ts_*).

Нуль часу — рядок «AS Igniter Off/Retract Start» у лозі тест-пойнта `<CIR>.txt` (той самий,
що бере 3D-replay у frontend/src/features/experiment-3d/lib/log.ts). Час кадру =
start_time архіву + t_ms − нуль.
"""

import re
from datetime import UTC, datetime

from flame.core.config import settings
from flame.media import service

ZERO = "AS Igniter Off/Retract Start"
_STAMP = re.compile(r"^\s*(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d(?:\.\d+)?)")


def _epoch_ms(date: str, time: str) -> float:
    return datetime.fromisoformat(f"{date}T{time}").replace(tzinfo=UTC).timestamp() * 1000


def ignition_epoch_ms(test_no: int, cir_id: str | None) -> float | None:
    if not cir_id:
        return None
    log = settings.flex_dir / "raw" / f"{test_no:03d}" / f"{cir_id}.txt"
    if not log.is_file():
        return None
    text = log.read_text(encoding="latin-1")
    at = text.find(f"{ZERO}:")
    if at < 0:
        return None
    m = _STAMP.match(text[at + len(ZERO) + 1 :])
    return _epoch_ms(m.group(1), m.group(2)) if m else None


def frame_times(index: service.FrameIndex, ignition_ms: float) -> list[float | None]:
    """Секунди від запалювання для кожного кадру (None — без мітки часу)."""
    if not index.start_time:
        return [None] * len(index.t_ms)
    date, _, time = index.start_time.partition("T")
    start = _epoch_ms(date, time) - ignition_ms
    return [None if ms is None else (start + ms) / 1000 for ms in index.t_ms]


def nearest(times: list[float | None], t: float) -> int | None:
    best, best_d = None, None
    for i, ft in enumerate(times):
        if ft is None:
            continue
        d = abs(ft - t)
        if best_d is None or d < best_d:
            best, best_d = i, d
    return best
