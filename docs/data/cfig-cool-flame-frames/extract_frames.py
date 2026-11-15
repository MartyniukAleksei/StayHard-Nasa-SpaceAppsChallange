#!/usr/bin/env python3
"""Витягає кадри тесту 21291C1 (ACME CFI-G, PSI-159) з архіву PSI для візуалізації «Dark pause».

    PYTHONPATH=backend/src python3 docs/data/cfig-cool-flame-frames/extract_frames.py

Що робить (деталі й причини: README.md поруч):
1. Читає лише центральний каталог zip `Images_Converted 21291C1.zip` (Range-запити, архів 248 МБ
   не качається) і записує розміри всіх 72 кадрів у frames.json (`archive`).
2. Для кількох кадрів тягне один запис (≈ 8 МБ кожен), перевіряє CRC, зменшує вдвічі усередненням
   2×2 у ЛІНІЙНИХ значеннях і зберігає JPEG, закодований як sqrt(x / 65519) · 255.
   Так 8 біт зберігають і тьмяне холодне полум'я, і насичене гаряче; браузер розкодовує
   x = (v / 255)² і застосовує повзунок експозиції до справжніх лінійних значень.
3. Пише frames.json (час кадру, sha256 TIFF, частка насичених пікселів, середня яскравість).

Потрібні numpy, tifffile, Pillow. Файли з PSI — недовірені дані: сюди вони потрапляють лише як
байти для декодування.
"""

import argparse
import hashlib
import io
import json
import posixpath
import re
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image, ImageFile

from flame.media import psi

ARCHIVE = "PSI-159_Raw Data_Images_Converted 21291C1.zip"
ARCHIVE_BYTES = 247639460
TEST = "21291C1"
IGNITION_GMT = datetime(2021, 10, 18, 18, 34, 58)  # tests.ignition_gmt (точність 1 с)
FULL_SCALE = 65519  # 12-бітне 4095 у 16-бітній шкалі конвертера (`Scaled tiff 0 4096`)
SATURATED = 65000
ImageFile.MAXBLOCK = 1 << 24  # без цього Pillow падає на `optimize=True` для великих JPEG
FRAMES = [39, 40, 41, 42, 44, 46, 48]  # індекси в архіві (00039 …)
OUT = Path(__file__).resolve().parents[3] / "frontend/src/features/cfig-cool/assets"


def frame_time(member: str) -> datetime:
    h, m, s, ms = re.match(r"\d{8}_(\d\d)(\d\d)(\d\d)\.(\d+)", posixpath.basename(member)).groups()
    return datetime(2021, 10, 18, int(h), int(m), int(s), int(ms) * 1000)


def encode(tif: np.ndarray) -> tuple[Image.Image, dict]:
    lin = tif.astype(np.float64) / FULL_SCALE
    h, w = lin.shape[:2]
    small = lin[: h // 2 * 2, : w // 2 * 2].reshape(h // 2, 2, w // 2, 2, 3).mean(axis=(1, 3))
    v8 = np.rint(255 * np.sqrt(np.clip(small, 0, 1))).astype(np.uint8)
    stats = {
        "saturated_pct": round(float((tif >= SATURATED).mean() * 100), 2),
        "mean_counts_of_4095": round(float(lin.mean() * 4095), 1),
    }
    return Image.fromarray(v8), stats


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path, help="каталог з уже завантаженими NNNNN.tif")
    args = ap.parse_args()

    psi.STUDY = "PSI-159"
    z = psi.open_zip(ARCHIVE, "1", ARCHIVE_BYTES)
    tifs = sorted(m for m in z.members if m.endswith(".tif"))
    t_first = frame_time(tifs[0])
    archive = [
        {
            "i": i,
            "t_s": round((frame_time(m) - IGNITION_GMT).total_seconds(), 1),
            "compressed_bytes": z.members[m].compress_size,
        }
        for i, m in enumerate(tifs)
    ]

    frames = []
    for i in FRAMES:
        member = tifs[i]
        cached = args.cache / f"{i:05d}.tif" if args.cache else None
        raw = cached.read_bytes() if cached and cached.exists() else z.read(member)
        img, stats = encode(tifffile.imread(io.BytesIO(raw)))
        name = f"frame-{i:05d}.jpg"
        img.save(OUT / name, "JPEG", quality=80, subsampling=2, optimize=True)
        frames.append(
            {
                "i": i,
                "file": name,
                "member": member,
                "camera_time_gmt": frame_time(member).isoformat(timespec="milliseconds"),
                "t_s": round((frame_time(member) - IGNITION_GMT).total_seconds(), 1),
                "source_tiff_sha256": hashlib.sha256(raw).hexdigest(),
                "jpeg_bytes": (OUT / name).stat().st_size,
                **stats,
            }
        )
        print(name, frames[-1]["jpeg_bytes"], stats, file=sys.stderr)

    meta = {
        "test_id": TEST,
        "archive_file": ARCHIVE,
        "t_zero": "tests.ignition_gmt = " + IGNITION_GMT.isoformat(sep=" ") + " (1 s resolution)",
        "first_frame_gmt": t_first.isoformat(timespec="milliseconds"),
        "encoding": "jpeg_value = round(255 * sqrt(counts / 65519)); counts = (jpeg_value / 255)^2 * 65519",
        "source_size_px": [1360, 1024],
        "stored_size_px": [680, 512],
        "frames": frames,
        "archive": archive,
    }
    (OUT / "frames.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
