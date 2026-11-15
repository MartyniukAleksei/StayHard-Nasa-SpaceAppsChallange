"""BASS-II: часові ряди з накладки даних на відео PSI → studies/bass2/video_series.json.

    uv run --with imageio-ffmpeg python -m flame.ingest.bass2_video --all          # усі тести
    uv run --with imageio-ffmpeg python -m flame.ingest.bass2_video --tests O13a B13
    uv run --with imageio-ffmpeg python -m flame.ingest.bass2_video --export   # лише JSON і звіт

Офлайн. На кадр відео бортова система впечатувала рядок даних: FUEL (витрата N₂), AIR (швидкість
повітря, см/с), FAN (напруга вентилятора ×10), RAD (радіометр) і годинник GMT. Таблицею NASA цих
чисел не публікувала. Для кожного тесту скрипт:

1. бере основний запис камери з `data/bass2/test_files.csv` і підписане посилання PSI;
2. качає його паралельними Range-запитами в `data/bass2_video/` (≈ 1–1.5 МБ/с, до 250 МБ на тест);
3. ffmpeg вирізає 2 кадри/с: смугу накладки і сцену під нею;
4. кожна клітинка накладки порівнюється з шаблонами `bass2_video_glyphs.json` (зсуви ±2 px);
5. медіанний фільтр, 1 точка/с, яскравість сцени як ознака видимого полум'я;
6. автозвірка зі ступенями вентилятора й повітря з журналу Додатку A (`appendix_a.json`);
7. відео видаляється, результат пишеться в `data/bass2_video/<test>.json`.

Перерваний прогін продовжується з місця зупинки (готові тести пропускаються). `--export` збирає
`video_series.json` (лише тести зі статусом `ok`) і `data/bass2_video/report.md`.
Числа — наша оцінка, не дані NASA; на сайті вони підписані *estimate*.
"""

import argparse
import csv
import io
import json
import math
import re
import shutil
import subprocess
import time
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np

from flame.core.config import settings

PKG = Path(__file__).resolve().parents[1]
GLYPHS = Path(__file__).with_name("bass2_video_glyphs.json")
APPENDIX = PKG / "studies" / "bass2" / "appendix_a.json"
OUT_JSON = PKG / "studies" / "bass2" / "video_series.json"
API = "https://psi.nasa.gov/geode-py/ws/studies/PSI-25/download"
UA = {"User-Agent": "Mozilla/5.0 (SpaceApps2026 flame-in-freefall)"}
STUDIES_ZIP = (
    "https://github.com/MartyniukAleksei/nasa-2026/releases/download/"
    "data-psi-studies-v1/psi-studies-v1.zip"
)

FPS = 2
OV_W, OV_H, OV_X = 570, 130, 150  # смуга накладки у кадрі 720×480
PITCH = 28.69  # крок символу накладки, px (однаковий в усіх записах)
SCENE = "crop=720:380:0:100,scale=360:190"  # сцена під накладкою, для яскравості
BRIGHT = 120  # поріг «світлого» пікселя гліфа
MAX_DIST = 70  # максимальна відстань до шаблону; далі — «?»
SHIFTS = [(dy, dx) for dy in (-2, -1, 0, 1, 2) for dx in (-2, -1, 0, 1, 2)]
SKIP_NAMES = ("still_sequence", "los_portion", "vlc-record")

# пороги автозвірки (статус ok / check)
MIN_OVERLAY = 0.5  # частка кадрів із накладкою
MIN_CLOCK = 0.9  # частка кадрів, де годинник узгоджений з часом відео (±1.5 с)
MIN_LOG_MATCH = 0.6  # частка чисел із журналу Додатку A, знайдених серед ступенів відео


# --- шаблони й розпізнавання (чисті функції, тести — tests/test_bass2_video.py) -----


def load_glyphs(path: Path = GLYPHS) -> tuple[np.ndarray, str, int, int]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    h, w = doc["height"], doc["width"]
    reps = np.array(
        [[[c == "#" for c in row] for row in g["rows"]] for g in doc["glyphs"]], dtype=np.int16
    ).reshape(len(doc["glyphs"]), h * w)
    return reps, "".join(g["char"] for g in doc["glyphs"]), h, w


REPS, LABELS, CH, CW = load_glyphs()


def read_cell(frame: np.ndarray, row: int, x0: int) -> str:
    """Один символ накладки: найближчий шаблон серед невеликих зсувів клітинки."""
    best: tuple[int, int] | None = None
    for dy, dx in SHIFTS:
        y, x = row + dy, x0 + dx
        if y < 0 or x < 0:
            continue
        c = frame[y : y + CH, x : x + CW]
        if c.shape != (CH, CW):
            continue
        bits = (c > BRIGHT).reshape(-1).astype(np.int16)
        if bits.sum() < 4:
            continue
        d = np.abs(REPS - bits).sum(1)
        j = int(d.argmin())
        if best is None or d[j] < best[0]:
            best = (int(d[j]), j)
    if best is None:
        return " "
    return LABELS[best[1]] if best[0] < MAX_DIST else "?"


def read_row(frame: np.ndarray, row: int, x0: int, n: int) -> str:
    return "".join(read_cell(frame, row, int(round(x0 + PITCH * i))) for i in range(n))


def parse_values(row: str) -> dict[str, float | None]:
    """Рядок значень накладки → поля (стовпчики FUEL / AIR / FAN / RAD)."""

    def num(s: str) -> float | None:
        try:
            return float(s.strip())
        except ValueError:
            return None

    return {
        "fuel": num(row[0:5]),
        "air": num(row[5:10]),
        "fan": num(row[10:15]),
        "rad": num(row[15:19]),
    }


def parse_clock(date_row: str) -> int | None:
    """`07/22/14 17:30:26` → секунди доби (двокрапки не розпізнаються, тому беремо позиції)."""
    try:
        return int(date_row[9:11]) * 3600 + int(date_row[12:14]) * 60 + int(date_row[15:17])
    except ValueError:
        return None


def median_filter(a: np.ndarray, w: int = 5) -> np.ndarray:
    out = np.full(len(a), np.nan)
    for i in range(len(a)):
        win = a[max(0, i - w // 2) : i + w // 2 + 1]
        if not np.all(np.isnan(win)):
            out[i] = np.nanmedian(win)
    return out


def plateaus(t: list[float], v: list[float], min_s: float = 8) -> list[tuple[float, float]]:
    """Ступені, що тримаються щонайменше `min_s` секунд: [(початок, значення)]."""
    steps: list[list[float]] = []
    for ti, vi in zip(t, v, strict=True):
        if vi is None or math.isnan(vi):
            continue
        r = round(vi)
        if not steps or steps[-1][1] != r:
            steps.append([ti, r, ti])
        steps[-1][2] = ti
    return [(s[0], s[1]) for s in steps if s[2] - s[0] >= min_s]


def log_numbers(text: str | None, lo: float, hi: float) -> list[float]:
    """Числа з тексту журналу в діапазоні [lo, hi] (напр. показання вентилятора 30–130)."""
    return [float(x) for x in re.findall(r"\d+(?:\.\d+)?", text or "") if lo <= float(x) <= hi]


def log_match(log_values: list[float], video_steps: list[float], tol: float = 1.0) -> float | None:
    """Частка чисел журналу, знайдених серед ступенів відео. None — у журналі чисел нема."""
    if not log_values:
        return None
    hits = sum(any(abs(a - b) <= tol for b in video_steps) for a in log_values)
    return hits / len(log_values)


def clock_consistency(clock: list[int | None], t: list[float]) -> tuple[int | None, float]:
    """Зсув годинника відносно часу відео (мода) і частка кадрів, що з ним узгоджені.
    Північ: різниця береться за модулем доби."""
    pairs = [(c, ti) for c, ti in zip(clock, t, strict=True) if c is not None]
    if not pairs:
        return None, 0.0
    offs = Counter(round((c - ti) % 86400) for c, ti in pairs)
    off = offs.most_common(1)[0][0]
    ok = sum(
        min(abs((c - ti - off) % 86400), 86400 - abs((c - ti - off) % 86400)) <= 1.5
        for c, ti in pairs
    )
    return off, ok / len(pairs)


# --- відео ---------------------------------------------------------------------------


def ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
    except ImportError as e:  # pragma: no cover - залежить від середовища
        raise SystemExit("ffmpeg not found: run with `uv run --with imageio-ffmpeg …`") from e
    return imageio_ffmpeg.get_ffmpeg_exe()


def main_video(test_id: str, files_csv: Path) -> dict[str, str] | None:
    """Основний запис камери: не стоп-кадри й не фрагменти LOS; перший ракурс раніше другого."""
    rows = [
        r
        for r in csv.DictReader(files_csv.open(encoding="utf-8"))
        if r["test_id"] == test_id
        and r["kind"] == "video"
        and not any(k in r["name"].lower() for k in SKIP_NAMES)
    ]
    rows.sort(key=lambda r: ("2nd_view" in r["name"].lower(), r["name"]))
    return rows[0] if rows else None


class _HttpRange(io.RawIOBase):
    """Файл за HTTP Range — щоб `zipfile` прочитав один запис архіву, не качаючи весь."""

    def __init__(self, url: str) -> None:
        req = urllib.request.Request(url, headers={**UA, "Range": "bytes=0-0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            self.url = r.geturl()
            self.size = int(r.headers["Content-Range"].split("/")[1])
        self.pos = 0

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, off: int, whence: int = 0) -> int:
        self.pos = {0: off, 1: self.pos + off, 2: self.size + off}[whence]
        return self.pos

    def readinto(self, b: Any) -> int:
        if self.pos >= self.size or not len(b):
            return 0
        end = min(self.pos + len(b), self.size) - 1
        req = urllib.request.Request(self.url, headers={**UA, "Range": f"bytes={self.pos}-{end}"})
        with urllib.request.urlopen(req, timeout=300) as r:
            data = r.read()
        b[: len(data)] = data
        self.pos += len(data)
        return len(data)


def fetch_file_list(dst: Path) -> None:
    """`bass2/test_files.csv` з релізу data-psi-studies-v1, не качаючи весь архів (1.6 ГБ)."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BufferedReader(_HttpRange(STUDIES_ZIP), 1 << 20)) as z:
        dst.write_bytes(z.read("bass2/test_files.csv"))


def signed_url(name: str, version: str) -> str:
    q = urllib.parse.urlencode({"file": name, "version": version, "redirect": "false"})
    req = urllib.request.Request(f"{API}?{q}", headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode().strip().strip('"')


def download(name: str, version: str, size: int, dst: Path, parts: int = 24) -> None:
    """Паралельні Range-запити (curl), дозавантаження неповних шматків, перевірка розміру."""
    if dst.exists() and dst.stat().st_size == size:
        return
    step = -(-size // parts)
    chunks = [(i * step, min((i + 1) * step, size) - 1) for i in range(parts)]
    paths = [dst.with_suffix(f".part{i:02d}") for i in range(parts)]
    for attempt in range(6):
        todo = [
            i
            for i, (s, e) in enumerate(chunks)
            if not paths[i].exists() or paths[i].stat().st_size != e - s + 1
        ]
        if not todo:
            break
        url = signed_url(name, version)  # живе ~1 год, тому беремо свіже на кожну спробу
        procs = [
            subprocess.Popen(
                [
                    "curl",
                    "-s",
                    "--retry",
                    "5",
                    "-r",
                    f"{chunks[i][0]}-{chunks[i][1]}",
                    "-o",
                    str(paths[i]),
                    url,
                ]
            )
            for i in todo
        ]
        for p in procs:
            p.wait()
        if attempt:
            time.sleep(5 * attempt)
    with dst.open("wb") as fo:
        for p in paths:
            fo.write(p.read_bytes())
            p.unlink()
    if dst.stat().st_size != size:
        raise RuntimeError(f"download incomplete: {dst.stat().st_size} of {size} bytes")


def frames(mp4: Path, vf: str, pix: str, shape: tuple[int, ...]) -> np.ndarray:
    raw = subprocess.run(
        [
            ffmpeg(),
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(mp4),
            "-vf",
            vf,
            "-pix_fmt",
            pix,
            "-f",
            "rawvideo",
            "-",
        ],
        capture_output=True,
        check=True,
    ).stdout
    per = int(np.prod(shape))
    return np.frombuffer(raw[: len(raw) // per * per], dtype=np.uint8).reshape(-1, *shape)


def find_grid(ov: np.ndarray) -> tuple[int, int, int]:
    """Рядки значень і дати та зсув першого символу в цьому записі."""
    sample = ov[:: max(1, len(ov) // 200)]
    prof = np.median((sample > BRIGHT).sum(2), axis=0)
    rows = [i for i in range(1, len(prof)) if prof[i] > 3 and prof[i - 1] <= 3]
    if len(rows) < 3:
        raise RuntimeError("no data overlay found in this video")
    val, date = rows[1], rows[2]
    digits = (0, 1, 3, 4, 6, 7, 9, 10, 12, 13, 15, 16)  # цифри дати й часу
    best: tuple[float, int] | None = None
    for x0 in range(0, 30):
        cost = 0.0
        for f in sample[:12]:
            for i in digits:
                x = int(round(x0 + PITCH * i))
                c = f[date : date + CH, x : x + CW]
                if c.shape[1] < CW:
                    cost += 1e3
                    continue
                cost += np.abs(REPS - (c > BRIGHT).reshape(-1).astype(np.int16)).sum(1).min()
        if best is None or cost < best[0]:
            best = (cost, x0)
    return val, date, best[1]


def process(
    test_id: str, work: Path, files_csv: Path, log: dict[str, Any], keep: bool
) -> dict[str, Any]:
    v = main_video(test_id, files_csv)
    if v is None:
        return {"test_id": test_id, "status": "no_video", "reason": "no main camera video in PSI"}
    mp4 = work / f"{test_id}.mp4"
    download(v["name"], v["version"], int(v["bytes"]), mp4)
    try:
        ov = frames(mp4, f"fps={FPS},crop={OV_W}:{OV_H}:{OV_X}:0,format=gray", "gray", (OV_H, OV_W))
        sc = frames(mp4, f"fps={FPS},{SCENE}", "rgb24", (190, 360, 3)).astype(np.int16)
    finally:
        if not keep:
            mp4.unlink(missing_ok=True)
    try:
        val_row, date_row, x0 = find_grid(ov)
    except RuntimeError as e:
        return {"test_id": test_id, "video_name": v["name"], "status": "failed", "reason": str(e)}
    n = min(len(ov), len(sc))
    t = [k / FPS for k in range(n)]
    blue = sc[:n, ..., 2]
    dropout = (blue.mean((1, 2)) > 150) & (sc[:n, ..., 0].mean((1, 2)) < 50)
    scene = (np.clip(blue - np.median(blue, axis=0), 0, None) > 12).sum((1, 2)).astype(float)
    scene[dropout] = np.nan
    cols = {k: np.full(n, np.nan) for k in ("fuel", "air", "fan", "rad")}
    clock: list[int | None] = [None] * n
    bad = 0
    for k in range(n):
        f = ov[k]
        if (f[date_row : date_row + CH] > BRIGHT).sum() < 200:
            continue
        vals, date = read_row(f, val_row, x0, 19), read_row(f, date_row, x0, 17)
        bad += "?" in vals + date
        for key, x in parse_values(vals).items():
            cols[key][k] = np.nan if x is None else x
        clock[k] = parse_clock(date)
    sm = {k: median_filter(a) for k, a in cols.items()}
    off, clock_ok = clock_consistency(clock, t)
    overlay = sum(c is not None for c in clock) / max(n, 1)
    fan_steps = [s for _, s in plateaus(t, list(sm["fan"]))]
    air_steps = [s for _, s in plateaus(t, list(sm["air"]))]
    entry = log.get(test_id) or {}
    match_fan = log_match(log_numbers(entry.get("fan_display"), 30, 130), fan_steps)
    match_air = log_match(log_numbers(entry.get("air_display"), 0, 60), air_steps)
    matches = [m for m in (match_fan, match_air) if m is not None]
    status = "ok"
    reasons = []
    if overlay < MIN_OVERLAY:
        reasons.append(f"overlay in {overlay:.0%} of frames")
    if clock_ok < MIN_CLOCK:
        reasons.append(f"clock consistent in {clock_ok:.0%} of frames")
    if matches and max(matches) < MIN_LOG_MATCH:
        reasons.append(f"log steps found: fan {match_fan}, air {match_air}")
    if reasons:
        status = "check"
    points = []
    for k in range(0, n, FPS):  # 1 Гц
        row = [t[k]] + [
            None if math.isnan(x) else round(float(x), 2)
            for x in (sm["air"][k], sm["fan"][k], sm["rad"][k], scene[k])
        ]
        points.append(row)
    start = None if off is None else f"{off // 3600 % 24:02d}:{off % 3600 // 60:02d}:{off % 60:02d}"
    return {
        "test_id": test_id,
        "video_name": v["name"],
        "status": status,
        "reason": "; ".join(reasons) or None,
        "qa": {
            "duration_s": n / FPS,
            "overlay_frames": round(overlay, 3),
            "clock_consistent": round(clock_ok, 3),
            "unreadable_frames": bad,
            "log_match_fan": match_fan,
            "log_match_air": match_air,
            "fan_steps": fan_steps[:20],
            "air_steps": air_steps[:20],
        },
        "start_gmt": start,
        "columns": ["t_s", "air_cm_s", "fan_display", "rad_rel", "scene_px"],
        "points": points,
    }


# --- експорт ---------------------------------------------------------------------------


METHOD = (
    "Template OCR of the data overlay burned into the PSI test video (2 frames/s, median of 5, "
    "kept at 1 Hz); scene_px = pixels brighter than the static background below the overlay "
    "(flame visibility proxy). Estimate, not NASA data."
)


def export(work: Path) -> None:
    results = [json.loads(p.read_text()) for p in sorted(work.glob("*.json"))]
    ok = {r["test_id"]: r for r in results if r["status"] == "ok"}
    # злиття: уже опубліковані ряди лишаються, нові результати `ok` їх оновлюють
    old = json.loads(OUT_JSON.read_text(encoding="utf-8"))["tests"] if OUT_JSON.exists() else {}
    keys = ("video_name", "start_gmt", "columns", "points")
    tests = {**old, **{tid: {k: r[k] for k in keys} for tid, r in ok.items()}}
    doc = {
        "method": METHOD,
        "source": "NASA PSI PSI-25 Raw Data videos",
        "tests": dict(sorted(tests.items())),
    }
    OUT_JSON.write_text(json.dumps(doc, separators=(",", ":")) + "\n", encoding="utf-8")
    by = Counter(r["status"] for r in results)
    lines = [
        "# BASS-II video OCR report",
        "",
        f"Tests processed: {len(results)} · "
        + " · ".join(f"{k}: {v}" for k, v in sorted(by.items())),
        f"`{OUT_JSON.name}`: {len(tests)} tests ({len(ok)} ok in this run, earlier ones kept).",
        "",
        "| test | status | duration, s | overlay | clock | log fan | log air | reason |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in sorted(results, key=lambda r: (r["status"] != "ok", r["test_id"])):
        q = r.get("qa", {})
        lines.append(
            f"| {r['test_id']} | {r['status']} | {q.get('duration_s', '')} | "
            f"{q.get('overlay_frames', '')} | {q.get('clock_consistent', '')} | "
            f"{q.get('log_match_fan', '')} | {q.get('log_match_air', '')} | "
            f"{r.get('reason') or ''} |"
        )
    (work / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        f"{OUT_JSON}: {len(tests)} tests ({len(ok)} ok in this run); report: {work / 'report.md'}"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--all", action="store_true", help="every BASS-II test with a camera video")
    g.add_argument("--tests", nargs="+", metavar="ID", help="only these tests, e.g. O13a B13")
    g.add_argument(
        "--export", action="store_true", help="only rebuild video_series.json and report.md"
    )
    ap.add_argument("--force", action="store_true", help="redo tests that already have a result")
    ap.add_argument("--keep-video", action="store_true", help="do not delete the downloaded mp4")
    ap.add_argument(
        "--shard",
        metavar="K/N",
        help="take every N-th test starting at K (1-based), to split the run between terminals",
    )
    args = ap.parse_args()

    snap = settings.study_dir("bass2")
    files_csv = snap / "test_files.csv"
    work = settings.data_dir / "bass2_video"
    work.mkdir(parents=True, exist_ok=True)
    if args.export:
        export(work)
        return
    if not files_csv.exists():
        print(
            f"{files_csv} not found: fetching it from the data-psi-studies-v1 release", flush=True
        )
        fetch_file_list(files_csv)
    log = {t["test_id"]: t for t in json.loads(APPENDIX.read_text(encoding="utf-8"))["tests"]}
    ids = args.tests or sorted(
        {r["test_id"] for r in csv.DictReader(files_csv.open(encoding="utf-8")) if r["test_id"]}
    )
    if args.shard:
        k, n = (int(x) for x in args.shard.split("/"))
        ids = ids[k - 1 :: n]
    for i, tid in enumerate(ids, 1):
        out = work / f"{tid}.json"
        if out.exists() and not args.force:
            print(f"[{i}/{len(ids)}] {tid}: done earlier, skipped", flush=True)
            continue
        t0 = time.time()
        try:
            res = process(tid, work, files_csv, log, args.keep_video)
        except Exception as e:  # noqa: BLE001 — один тест не зупиняє весь прогін
            res = {"test_id": tid, "status": "failed", "reason": f"{type(e).__name__}: {e}"}
        out.write_text(json.dumps(res) + "\n", encoding="utf-8")
        print(
            f"[{i}/{len(ids)}] {tid}: {res['status']} {res.get('reason') or ''} "
            f"({time.time() - t0:.0f} s)",
            flush=True,
        )
    export(work)


if __name__ == "__main__":
    main()
