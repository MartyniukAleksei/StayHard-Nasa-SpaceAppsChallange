"""Кадри камер FLEX з PSI: список камер тесту, індекс кадрів, рендер одного кадру в JPEG.

Кадри — сирі знімки з борту МКС (A: 16-біт TIFF, B: 16-біт TIFF, D: 24-біт BMP), браузер їх не
показує, тому конвертуємо в 8-біт JPEG. Яскравість масштабується ФІКСОВАНИМ вікном на камеру
(не автоконтрастом на кадр), щоб послідовність кадрів не мерехтіла і яскравість між кадрами
лишалась порівнянною. Це відображення, а не вимірювання: числа беремо з ts_* у БД.
"""

import io
import posixpath
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache

from duckdb import DuckDBPyConnection
from PIL import Image

from flame.media import psi, repository

MAX_SIDE = 1024
_IMAGE_EXT = (".tif", ".tiff", ".bmp", ".png", ".jpg")


@dataclass(frozen=True)
class CameraInfo:
    label: str
    view: str
    window: int  # верхня межа 16-біт значень, що мапиться в 255 (лише для 16-біт кадрів)


# Букви камер звірені з *_Camera_Settings.txt і вмістом архівів (docs/data/flex.md).
CAMERAS = {
    "A": CameraInfo("HiBMS", "Backlit droplet silhouette, 1024×1024", 65535),  # 12 біт у старших
    "B": CameraInfo("LLL-UV", "Flame in UV (OH* chemiluminescence), 512×512", 4095),  # тьмяна
    "C": CameraInfo("Camera C", "Unidentified camera", 65535),
    "D": CameraInfo("Color", "Flame, color camera, 640×480", 65535),
}
_UNKNOWN = CameraInfo("Unknown", "Unidentified camera", 65535)


class NotFound(LookupError):
    pass


@dataclass(frozen=True)
class Camera:
    camera: str
    info: CameraInfo
    archive: repository.CameraArchive


@dataclass(frozen=True)
class FrameIndex:
    members: tuple[str, ...]  # ім'я запису в zip для кадру i
    t_ms: tuple[int | None, ...]  # мс від першого кадру
    start_time: str | None  # бортовий час першого кадру, ISO


def cameras(cur: DuckDBPyConnection, test_no: int) -> list[Camera]:
    if not repository.test_exists(cur, test_no):
        raise NotFound(f"test {test_no} not found")
    return [
        Camera(a.camera, CAMERAS.get(a.camera, _UNKNOWN), a)
        for a in repository.camera_archives(cur, test_no)
    ]


def camera(cur: DuckDBPyConnection, test_no: int, cam: str) -> Camera:
    for c in cameras(cur, test_no):
        if c.camera == cam.upper():
            return c
    raise NotFound(f"test {test_no} has no frames from camera {cam}")


def frame_index(cam: Camera) -> FrameIndex:
    a = cam.archive
    return _frame_index(a.name, a.version, a.bytes)


@lru_cache(maxsize=64)
def _frame_index(name: str, version: str, size: int) -> FrameIndex:
    z = psi.open_zip(name, version, size)
    images = {
        posixpath.splitext(posixpath.basename(m))[0]: m
        for m in sorted(z.members)
        if m.lower().endswith(_IMAGE_EXT)
    }
    txt = [m for m in z.members if m.lower().endswith(".txt")]
    rows = _parse_index(z.read(txt[0]).decode("latin-1")) if txt else []
    rows = [r for r in rows if r[2] in images]
    if not rows:  # без індексу — просто кадри за іменем, без часу
        return FrameIndex(tuple(images.values()), (None,) * len(images), None)

    t0 = rows[0][0]
    t_ms = tuple((ms - t0) % 86_400_000 for ms, _, _ in rows)  # Mseconds — мс від півночі
    return FrameIndex(tuple(images[f] for _, _, f in rows), t_ms, rows[0][1])


def _parse_index(text: str) -> list[tuple[int, str | None, str]]:
    """`<CIR><cam>.txt`: ImgNum, DiskNum, FileNum, FileIndex, Mseconds, Delta, Date,
    MTimeStamp, FileName → [(Mseconds, ISO-час, FileName)] у порядку кадрів."""
    out = []
    for line in text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) != 9 or not parts[0].isdigit():
            continue
        try:
            ms = int(parts[4])
        except ValueError:
            continue
        try:
            iso = datetime.strptime(f"{parts[6]} {parts[7]}", "%m/%d/%Y %H:%M:%S.%f").isoformat()
        except ValueError:
            iso = None
        out.append((ms, iso, parts[8]))
    return out


def frame_jpeg(cam: Camera, i: int, max_side: int | None) -> bytes:
    idx = frame_index(cam)
    if not 0 <= i < len(idx.members):
        raise NotFound(f"frame {i} out of range 0..{len(idx.members) - 1}")
    a = cam.archive
    return _render(a.name, a.version, a.bytes, idx.members[i], cam.info.window, max_side)


@lru_cache(maxsize=128)
def _render(
    name: str, version: str, size: int, member: str, window: int, max_side: int | None
) -> bytes:
    raw = psi.open_zip(name, version, size).read(member)
    img = to_display(Image.open(io.BytesIO(raw)), window)
    if max_side and max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, "JPEG", quality=85)
    return out.getvalue()


def to_display(img: Image.Image, window: int) -> Image.Image:
    """Сирий кадр → 8-біт L/RGB. 16-біт: лінійно [0, window] → [0, 255] з обрізанням."""
    if img.mode.startswith("I"):  # I;16* і I: лінійне масштабування, convert("L") обрізає до 255
        scale = 255 / window
        return img.convert("I").point(lambda v: v * scale).convert("L")
    if img.mode in ("L", "RGB"):
        return img
    return img.convert("RGB")
