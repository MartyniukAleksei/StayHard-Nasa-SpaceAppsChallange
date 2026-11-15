"""Читання файлів із PSI (NASA Physical Sciences Informatics) поштучно, без завантаження цілком.

PSI віддає файл через підписане S3-посилання (`/download?redirect=false`), а S3 підтримує
HTTP Range. Тому з zip-архіву кадрів (до 2.4 ГБ) читаємо лише центральний каталог (кінець файлу)
і потрібний запис — кілька сотень КБ замість гігабайтів. Деталі API: docs/data/psi_api.md.

Це «репозиторій» зовнішнього джерела: сервіс викликає лише `RemoteZip`, тести підміняють
`fetch_range`.
"""

import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import zlib
from dataclasses import dataclass
from functools import lru_cache

API = "https://psi.nasa.gov/geode-py/ws"
STUDY = "PSI-69"
_UA = {"User-Agent": "Mozilla/5.0 (SpaceApps2026 flame-in-freefall)"}
_TIMEOUT = 30
_URL_MARGIN_S = 60  # оновлюємо підписане посилання трохи раніше, ніж воно протухне


class PsiUnavailable(RuntimeError):
    """PSI або S3 не відповіли / відповіли помилкою."""


_urls: dict[tuple[str, str], tuple[str, float]] = {}
_urls_lock = threading.Lock()


def _signed_url(name: str, version: str, *, fresh: bool = False) -> str:
    key = (name, version)
    with _urls_lock:
        cached = _urls.get(key)
    if cached and not fresh and cached[1] > time.time():
        return cached[0]
    q = urllib.parse.urlencode({"file": name, "version": version, "redirect": "false"})
    req = urllib.request.Request(f"{API}/studies/{STUDY}/download?{q}", headers=_UA)
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as r:
            url = r.read().decode().strip().strip('"')
    except (urllib.error.URLError, TimeoutError) as e:
        raise PsiUnavailable(f"PSI download link for {name}: {e}") from e
    expires = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("Expires", ["0"])[0]
    valid_until = (int(expires) if expires.isdigit() else time.time() + 600) - _URL_MARGIN_S
    with _urls_lock:
        _urls[key] = (url, valid_until)
    return url


def fetch_range(name: str, version: str, start: int, end: int) -> bytes:
    """Байти [start, end) файлу PSI. Одне HTTP-звернення до S3 (плюс, зрідка, оновлення лінка)."""
    for attempt in range(2):
        url = _signed_url(name, version, fresh=attempt > 0)
        req = urllib.request.Request(url, headers={**_UA, "Range": f"bytes={start}-{end - 1}"})
        try:
            with urllib.request.urlopen(req, timeout=_TIMEOUT) as r:
                if r.status != 206:
                    raise PsiUnavailable(f"S3 ignored Range for {name} (status {r.status})")
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (400, 403) and attempt == 0:  # підпис протух — беремо новий лінк
                continue
            raise PsiUnavailable(f"S3 {e.code} for {name}") from e
        except (urllib.error.URLError, TimeoutError) as e:
            raise PsiUnavailable(f"S3 unreachable for {name}: {e}") from e
    raise PsiUnavailable(f"S3 refused {name}")


class _RangeFile:
    """Мінімальний seekable file-object поверх `fetch_range` для `zipfile` (читає лише каталог)."""

    def __init__(self, name: str, version: str, size: int) -> None:
        self.name, self.version, self.size, self.pos = name, version, size, 0

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = 0) -> int:
        base = {0: 0, 1: self.pos, 2: self.size}[whence]
        self.pos = base + offset
        return self.pos

    def read(self, n: int = -1) -> bytes:
        end = self.size if n < 0 else min(self.size, self.pos + n)
        if end <= self.pos:
            return b""
        data = fetch_range(self.name, self.version, self.pos, end)
        self.pos += len(data)
        return data


@dataclass(frozen=True)
class Member:
    name: str
    offset: int  # зсув локального заголовка
    compress_size: int
    file_size: int
    method: int
    crc: int


class RemoteZip:
    """Каталог zip-архіву з PSI + читання окремих записів одним Range-запитом."""

    def __init__(self, name: str, version: str, size: int) -> None:
        self.name, self.version = name, version
        try:
            with zipfile.ZipFile(_RangeFile(name, version, size)) as z:  # type: ignore[arg-type]
                infos = z.infolist()
        except zipfile.BadZipFile as e:
            raise PsiUnavailable(f"{name} is not a readable zip: {e}") from e
        self.members = {
            i.filename: Member(
                i.filename, i.header_offset, i.compress_size, i.file_size, i.compress_type, i.CRC
            )
            for i in infos
            if not i.is_dir()
        }

    def read(self, member: str) -> bytes:
        m = self.members[member]
        # локальний заголовок: 30 байт + ім'я + extra (довжина extra може відрізнятись від каталогу)
        head = 30 + len(m.name.encode()) + 256
        buf = fetch_range(self.name, self.version, m.offset, m.offset + head + m.compress_size)
        if buf[:4] != b"PK\x03\x04":
            raise PsiUnavailable(f"bad local header for {member} in {self.name}")
        start = 30 + int.from_bytes(buf[26:28], "little") + int.from_bytes(buf[28:30], "little")
        if start + m.compress_size <= len(buf):
            raw = buf[start : start + m.compress_size]
        else:  # extra довше за запас — дочитуємо дані окремим запитом
            data_at = m.offset + start
            raw = fetch_range(self.name, self.version, data_at, data_at + m.compress_size)
        if m.method == zipfile.ZIP_STORED:
            data = raw
        elif m.method == zipfile.ZIP_DEFLATED:
            data = zlib.decompress(raw, -15)
        else:
            raise PsiUnavailable(f"unsupported zip method {m.method} for {member}")
        if zlib.crc32(data) != m.crc:
            raise PsiUnavailable(f"CRC mismatch for {member} in {self.name}")
        return data


@lru_cache(maxsize=64)
def open_zip(name: str, version: str, size: int) -> RemoteZip:
    """Каталог кешується в пам'яті процесу: дані статичні, каталог ~1–2 тис. записів."""
    return RemoteZip(name, version, size)
