"""Ліміти агента: запити з IP і стеля витрат процесу. Стан — у пам'яті (один інстанс).

Жорсткий ліміт витрат — в Anthropic Console; цей лічильник лише зупиняє процес раніше й дає
користувачеві зрозуміле пояснення замість помилки API.
"""

import json
import threading
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Any

# $ за 1M токенів: вхід, вихід, запис у кеш (5 хв), читання з кешу
PRICES = {
    "claude-sonnet-5-5": (2.0, 10.0, 2.5, 0.10),
    "claude-sonnet-5": (2.0, 10.0, 2.5, 0.20),
}
DEFAULT_PRICE = PRICES["claude-sonnet-5-5"]


def cost_usd(model: str, usage: Any) -> float:
    p_in, p_out, p_write, p_read = PRICES.get(model, DEFAULT_PRICE)

    def g(name: str) -> int:
        v = usage.get(name) if isinstance(usage, dict) else getattr(usage, name, None)
        return int(v or 0)

    return (
        g("input_tokens") * p_in
        + g("output_tokens") * p_out
        + g("cache_creation_input_tokens") * p_write
        + g("cache_read_input_tokens") * p_read
    ) / 1e6


class RateLimiter:
    def __init__(self, per_minute: int, per_day: int) -> None:
        self.per_minute, self.per_day = per_minute, per_day
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, now: float | None = None) -> int | None:
        """None — дозволено (і зараховано); інакше — через скільки секунд можна знову."""
        now = time.time() if now is None else now
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > 86400:
                hits.popleft()
            minute = [t for t in hits if now - t < 60]
            if len(minute) >= self.per_minute:
                return int(60 - (now - minute[0])) + 1 if minute else 60
            if len(hits) >= self.per_day:
                return int(86400 - (now - hits[0])) + 1 if hits else 86400
            hits.append(now)
            return None


class Budget:
    def __init__(self, limit_usd: float) -> None:
        self.limit = limit_usd
        self.spent = 0.0
        self._lock = threading.Lock()

    def add(self, usd: float) -> None:
        with self._lock:
            self.spent += usd

    @property
    def exhausted(self) -> bool:
        return self.spent >= self.limit


def ledger_add(path: Path, usd: float, label: str) -> float:
    """Журнал витрат ручних прогонів (eval, smoke) — НЕ API. Повертає загальну суму."""
    data = json.loads(path.read_text()) if path.exists() else {"total_usd": 0.0, "runs": []}
    data["total_usd"] = round(data["total_usd"] + usd, 5)
    data["runs"].append({"label": label, "usd": round(usd, 5), "at": int(time.time())})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1))
    return data["total_usd"]


def ledger_total(path: Path) -> float:
    return json.loads(path.read_text())["total_usd"] if path.exists() else 0.0
