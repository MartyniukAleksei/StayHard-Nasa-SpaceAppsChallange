"""CFI (PSI-39) dataset builder: знімок даних Cool Flames Investigation з NASA PSI.

CFI продовжує FLEX на тій самій установці (CIR/MDCA, МКС, 2017): нумерація тестів —
`Flex Number` 1206–1431, ті самі файли DropletData / ColorCamData / TestSheet. Тому знімок має
ту саму будову, що й `data/flex/` (див. `psi_flex.py`), лише з власним набором часових рядів:

  data/cfi/
    about.json, manifest.json
    tests.csv                    227 тестів (джерело — CFI_DataSummary_Spreadsheet_Jan2021.xlsx)
    test_files.csv               індекс усіх файлів PSI-39 з прив'язкою до тесту
    timeseries/droplet/NNNN.csv      t_s, d_mm, x_mm, y_mm              (DropletData.txt)
    timeseries/flame_color/NNNN.csv  t_s, flame_d_mm, standoff          (ColorCamData.txt)
    timeseries/cool_flame/NNNN.csv   t_s, d_fwhm_mm, d_p2p_mm           (CoolFlameData.txt)
    timeseries/radiometer/NNNN.csv   t_s, wide_w, narrow_w              (RadiometerData.txt)
    timeseries/chamber/NNNN.csv      timestamp, p_psia, T1..T4_C        (Chamber_Readings.txt)
    timeseries/<kind>_all.csv        те саме одним файлом з test_no
    raw/NNNN/...  docs/<категорія>/...  media/NNNN/...
    cfi.duckdb                   tests, test_files, ts_* (якщо встановлено duckdb)

Чому тести беремо з xlsx, а не з «Experimental table» PSI: таблиця PSI має 87 рядків (79 унікальних,
1285–1297 задубльовано), а зведення науковців — 227 тестів з D0, Dext, K гарячого й холодного
полум'я, кількістю перезапалювань і коментарями. Таблицю PSI зберігаємо як перехресну перевірку
(`in_psi_table`, розбіжності друкуються під час збірки).

Запуск (з backend/):
    uv run python -m flame.ingest.psi_cfi                         # з PSI API, ~0.7 ГБ
    uv run python -m flame.ingest.psi_cfi --src <дзеркало>/PSI-39_CFI   # з локальної копії
    uv run python -m flame.ingest.psi_cfi --videos 60             # + mp4 до 60 МБ
    uv run python -m flame.ingest.psi_cfi --verify                # перевірка за manifest.json

Дзеркало для `--src` — каталог `<ACC>_<назва>/{about.json, catalog.csv, files/...}`
(так розкладає дані скрипт psi_fetch.py з репозиторію-парсера). Файл, якого немає в дзеркалі
або в якого не збігається розмір, докачується з PSI.

Дані: NASA PSI, CC0-1.0. Цитувати DOI CFI (about.json → doi).
"""

import argparse
import csv
import glob
import io
import json
import os
import re
import shutil
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, date, datetime, timedelta

from flame.core.config import settings
from flame.ingest.psi_flex import (
    API,
    UA,
    flatten,
    get_json,
    http,
    num,
    parse_chamber,
    parse_testsheet,
    parse_tsv,
    read_text,
    sha256,
    write_csv,
)

ACC = "PSI-39"
SLUG = "cfi"
DATASET_VERSION = "cfi-v1"
SUMMARY_XLSX = "CFI_DataSummary_Spreadsheet"

# легкі файли тесту, які кладемо в raw/
LIGHT_KINDS = {
    "testsheet_txt", "droplet_ts", "flame_color_ts", "cool_flame_ts", "radiometer_ts",
    "summary_pdf", "other_pdf", "testpoint_log", "comments", "testpoint_settings",
    "camera_settings", "filter_positions", "chamber_ts", "radiometer_raw", "camera_index_txt",
    "other_txt",
}  # fmt: skip
DOC_CATEGORIES = (
    "Engineering Documents", "Presentations", "Science Documents", "Reports", "Experimental table",
)  # fmt: skip

# часові ряди: суфікс файлу → (каталог, колонки, скільки перших колонок брати)
TIMESERIES = {
    "_dropletdata.txt": ("droplet", ["t_s", "d_mm", "x_mm", "y_mm"]),
    "_colorcamdata.txt": ("flame_color", ["t_s", "flame_d_mm", "standoff"]),
    "_coolflamedata.txt": ("cool_flame", ["t_s", "d_fwhm_mm", "d_p2p_mm"]),
    "_radiometerdata.txt": ("radiometer", ["t_s", "wide_w", "narrow_w"]),
}
CHAMBER_COLS = ["timestamp", "p_psia", "T1_C", "T2_C", "T3_C", "T4_C"]
TS_KINDS = [*(v[0] for v in TIMESERIES.values()), "chamber"]
# у PSI ці файли мають правильний розмір, але вміст — сміття (не PDF/RTF); у знімок не кладемо
KNOWN_BAD = {
    "PSI-39_Raw Data_FLEX-1248_TestSheet.rtf",
    "PSI-39_Analyzed Data_FLEX-1248_Summary.pdf",
}

CIR_RE = re.compile(r"F(\d{3}[A-Z]\d{2})", re.I)  # CIR-ID тесту CFI: F068A03


# ------------------------------------------------------------------ PSI
def signed_url(name: str, version) -> str:
    q = urllib.parse.urlencode({"file": name, "version": version, "redirect": "false"})
    return http(f"{API}/studies/{ACC}/download?{q}").decode().strip().strip('"')


def fetch(name: str, version, dest: str, size: int | None, src_path: str | None) -> str:
    """Кладе файл у dest: з дзеркала, якщо там правильний розмір, інакше з PSI."""
    if os.path.exists(dest) and (size is None or os.path.getsize(dest) == size):
        return "skip"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if (
        src_path
        and os.path.exists(src_path)
        and (size is None or os.path.getsize(src_path) == size)
    ):
        shutil.copyfile(src_path, dest)
        return "copy"
    tmp = dest + ".part"
    req = urllib.request.Request(
        signed_url(name, version), headers={"User-Agent": UA["User-Agent"]}
    )
    with urllib.request.urlopen(req, timeout=600) as r, open(tmp, "wb") as out:
        shutil.copyfileobj(r, out, length=1 << 20)
    os.replace(tmp, dest)
    return "ok"


def load_tree(src: str | None) -> tuple[dict, list[dict]]:
    """Метадані дослідження і плаский список файлів (з дзеркала або з API)."""
    if src:
        with open(os.path.join(src, "about.json"), encoding="utf-8") as fh:
            meta = json.load(fh)
        with open(os.path.join(src, "catalog.csv"), encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
        files = [
            {
                "key": "/".join(p for p in (r["category"], r["subfolder"], r["name"]) if p),
                "name": r["name"],
                "bytes": int(r["bytes"] or 0),
                "category": r["category"],
                "subfolder": r["subfolder"],
                "version": int(r["version"] or 1),
                "restricted": r["restricted"] == "True",
                "src_path": os.path.join(src, r["local_path"]) if r.get("local_path") else None,
            }
            for r in rows
        ]
        return meta, files
    meta = get_json(f"{API}/repo/investigations/{ACC}")
    body = {"folder": "", "fileType": "study", "studyId": ACC,
            "version": meta.get("version", 1), "obfuscationcode": ""}  # fmt: skip
    files = flatten(get_json(f"{API}/files/v2", body).get("files") or [])
    for f in files:
        f["src_path"] = None
    return meta, files


# ------------------------------------------------------------------ xlsx (stdlib)
_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def _col_index(ref: str) -> int:
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_xlsx(path_or_bytes) -> dict[str, list[list]]:
    """Усі аркуші xlsx як списки рядків (значення: str | float | None). Без openpyxl."""
    src = io.BytesIO(path_or_bytes) if isinstance(path_or_bytes, bytes) else path_or_bytes
    with zipfile.ZipFile(src) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", _NS):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{_NS['m']}}}t")))
        rels = {
            r.get("Id"): r.get("Target")
            for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        }
        out = {}
        for sh in ET.fromstring(z.read("xl/workbook.xml")).find("m:sheets", _NS):
            target = rels[sh.get(_REL)].lstrip("/")
            target = target if target.startswith("xl/") else "xl/" + target
            rows = []
            for row in ET.fromstring(z.read(target)).iter(f"{{{_NS['m']}}}row"):
                vals: dict[int, object] = {}
                for c in row.findall("m:c", _NS):
                    t, v = c.get("t"), c.find("m:v", _NS)
                    if t == "s" and v is not None:
                        val = shared[int(v.text)]
                    elif t == "inlineStr":
                        val = "".join(x.text or "" for x in c.iter(f"{{{_NS['m']}}}t"))
                    elif v is None or v.text is None:
                        val = None
                    elif t in ("str", "e", "b"):
                        val = v.text
                    else:
                        val = float(v.text)
                    vals[_col_index(c.get("r"))] = val
                if vals:
                    rows.append([vals.get(i) for i in range(max(vals) + 1)])
            out[sh.get("name")] = rows
    return out


def excel_date(v) -> str:
    """Серійна дата Excel (або вже рядок) → ISO YYYY-MM-DD."""
    if isinstance(v, float):
        return (date(1899, 12, 30) + timedelta(days=int(v))).isoformat()
    return str(v or "").strip()


# ------------------------------------------------------------------ normalization
def parse_pressure(v) -> float | None:
    """'1 atm ', '.75 atm', 1.25 → атм."""
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"\d*\.?\d+", str(v or ""))
    return float(m.group(0)) if m else None


def normalize_fuel(v) -> tuple[str, float | None]:
    """'[.60]/[.40] C12H26/iso-dodecane' → ('dodecane/isododecane', 0.60) — частка н-додекану."""
    s = str(v or "").strip()
    low = s.lower()
    if "farnesane" in low:
        return "farnesane", None
    if "iso" in low:
        m = re.search(r"\[\s*(\d*\.?\d+)\s*\]", s)
        return "dodecane/isododecane", (float(m.group(1)) if m else None)
    if "c12h26" in low or "dodecane" in low:
        return "dodecane", 1.0
    return low, None


def yes_no(v) -> bool | None:
    s = str(v or "").strip().lower()
    return True if s.startswith("y") else False if s.startswith("n") else None


def sheet_dicts(rows: list[list], key: str = "Flex Number") -> dict[int, dict]:
    """Аркуш → {Flex Number: {заголовок: значення}}; порожні рядки відкидаємо."""
    head = [str(h or "").strip() for h in rows[0]]
    out = {}
    for r in rows[1:]:
        d = {h: (r[i] if i < len(r) else None) for i, h in enumerate(head) if h}
        n = num(d.get(key))
        if n is not None:
            out[int(n)] = d
    return out


def parse_summary(sheets: dict[str, list[list]]) -> list[dict]:
    """Зведення науковців (xlsx) → нормалізовані рядки tests."""
    master = sheet_dicts(sheets["Master Sheet"])
    data = sheet_dicts(sheets.get("DATA", [[]])) if sheets.get("DATA") else {}
    ign = sheet_dicts(sheets["Igniter"]) if sheets.get("Igniter") else {}
    comm = sheet_dicts(sheets["Comments"]) if sheets.get("Comments") else {}

    def f(d: dict, col: str) -> float | None:
        v = d.get(col)
        return v if isinstance(v, float) else num(v)

    tests = []
    for n in sorted(master):
        m, d, g = master[n], data.get(n, {}), ign.get(n, {})
        fuel, x_dodecane = normalize_fuel(m.get("Fuel"))
        t = {
            "test_no": n,
            "cir_id": str(m.get("CIR") or "").strip().upper(),
            "test_date": excel_date(m.get("Test Date")),
            "test_time_local": str(m.get("Local Time") or "").strip(),
            "fuel": fuel,
            "x_dodecane": x_dodecane,
            "fuel_raw": str(m.get("Fuel") or "").strip(),
            "p_atm": parse_pressure(m.get("Pressure")),
            "x_o2": f(m, "Oxygen"),
            "x_n2": f(m, "Nitrogen"),
            "x_he": f(m, "Helium"),
            "fiber": yes_no(m.get("Fiber")),
            "d0_mm": f(d, "D0 ( mm )"),
            "dext_hot_mm": f(d, "Dext, hot ( mm )"),
            "k_hot_mm2_s": f(d, "khot ( mm^2/s )"),
            "k_cool_mm2_s": f(d, "kcool ( mm^2/s )"),
            "dext_cool_mm": f(d, "Dext,cool ( mm )"),
            "reignitions": f(d, "Reignitions"),
            "cool_flame_extrapolated": yes_no({1.0: "y", 0.0: "n"}.get(f(d, "Extrap CF?"))),
            "hot_flame_burn_time_s": f(d, "HF Burn Time"),
            "peak_hot_flame_rad_w": f(d, "Peak HF Rad"),
            "peak_water_vapor_rad_w": f(d, "Peak Water Vapor Rad"),
            "analysis_completed": yes_no(d.get("Completed Analysis?")),
            "ignition_power_w": num(
                re.sub(r"[^\d.]", "", str(g.get("Ignition Power ( W )") or ""))
            ),
            "ignition_time_ms": num(
                re.sub(r"[^\d.]", "", str(g.get("Ignition Time ( ms )") or ""))
            ),
            "comment": re.sub(r"\s+", " ", str(comm.get(n, {}).get("Comments") or "")).strip(),
        }
        s = sum(v for v in (t["x_o2"], t["x_n2"], t["x_he"]) if v)
        t["diluent"] = "He" if t["x_he"] else ("N2" if s else None)
        tests.append(t)
    return tests


def parse_psi_table(text: str) -> dict[int, dict]:
    """«Experimental table» з PSI: {Flex Number: рядок}; дублікати схлопуються."""
    rows = list(csv.reader(io.StringIO(text)))
    head = [h.strip() for h in rows[0]]
    out = {}
    for r in rows[1:]:
        d = dict(zip(head, (c.strip() for c in r), strict=False))
        n = num(d.get("Flex Number"))
        if n is not None:
            out.setdefault(int(n), d)
    return out


def cross_check(tests: list[dict], psi: dict[int, dict]) -> list[str]:
    """Розбіжності умов між xlsx і таблицею PSI (тиск, O2, He, нитка, CIR)."""
    issues = []
    for t in tests:
        p = psi.get(t["test_no"])
        t["in_psi_table"] = p is not None
        if not p:
            continue
        pairs = [
            ("cir_id", t["cir_id"], p.get("CIR", "").upper()),
            ("p_atm", t["p_atm"], parse_pressure(p.get("Pressure"))),
            ("x_o2", t["x_o2"], num(p.get("Oxygen"))),
            ("x_he", t["x_he"], num(p.get("Helium"))),
            ("fiber", t["fiber"], yes_no(p.get("Fiber"))),
        ]
        for k, a, b in pairs:
            if a != b and not (isinstance(a, float) and isinstance(b, float) and abs(a - b) < 1e-6):
                issues.append(f"{t['test_no']}: {k} xlsx={a!r} psi={b!r}")
    return issues


# ------------------------------------------------------------------ files
def classify(name: str) -> tuple[str, str | None]:
    """Тип файлу CFI за іменем. Повертає (kind, camera_letter|None)."""
    n = re.sub(r"^PSI-39_[^_]+_", "", name)
    e = n.rsplit(".", 1)[-1].lower() if "." in n else ""
    rules = [
        (r"_TestSheet\.txt$", "testsheet_txt"), (r"_TestSheet\.rtf$", "testsheet_rtf"),
        (r"_DropletData\.txt$", "droplet_ts"), (r"_ColorCamData\.txt$", "flame_color_ts"),
        (r"_CoolFlameData\.txt$", "cool_flame_ts"), (r"_RadiometerData\.txt$", "radiometer_ts"),
        (r"Summary[\w-]*\.pdf$", "summary_pdf"), (r"_Chamber_Readings\.txt$", "chamber_ts"),
        (r"_Radiometer_Readings\.txt$", "radiometer_raw"),
        (r"_Comments\s*\d*\s*\.txt$", "comments"), (r"_Filter_Positions\.txt$", "filter_positions"),
        (r"Testpoint_Settings\.txt$", "testpoint_settings"),
        (r"Cam\w*_Settings\.txt$", "camera_settings"),
    ]  # fmt: skip
    for pat, kind in rules:
        if re.search(pat, n, re.I):
            return kind, None
    if e == "zip":
        m = re.search(r"\d([A-Z])\.zip$", n, re.I)
        return "camera_images_zip", (m.group(1).upper() if m else None)
    if e in ("mp4", "mpg", "avi"):
        return "video", None
    if re.match(r"^F\d{3}[A-Z]\d{2}[A-Z]\.txt$", n, re.I):
        return "camera_index_txt", n[-5].upper()
    if re.match(r"^F\d{3}[A-Z]\d{2}\.txt$", n, re.I):
        return "testpoint_log", None
    if e in ("pdf", "txt"):
        return "other_" + e, None
    return "other_" + (e or "bin"), None


def bind(f: dict, by_no: dict[int, dict], by_cir: dict[str, int]) -> tuple[int | None, str]:
    """Прив'язка файлу до тесту: FLEX-NNNN в імені → CIR в імені → те саме в папці."""
    if f["category"] not in ("Raw Data", "Analyzed Data"):
        return None, ""
    base = re.sub(r"^PSI-39_[^_]+_", "", f["name"])
    for text, tag in ((base, "name"), (f["subfolder"], "folder")):
        m = re.search(r"FLEX[-_ ]?(\d{4})", text, re.I)
        if m and int(m.group(1)) in by_no:
            return int(m.group(1)), f"flex_{tag}"
        for c in CIR_RE.findall(text):
            if "F" + c.upper() in by_cir:
                return by_cir["F" + c.upper()], f"cir_{tag}"
    return None, ""


def raw_name(name: str) -> str:
    return re.sub(r"^PSI-39_[^_]+_", "", name)


# ------------------------------------------------------------------ main
def verify(out: str) -> None:
    with open(os.path.join(out, "manifest.json"), encoding="utf-8") as fh:
        man = json.load(fh)
    bad = [
        p
        for p, m in man["files"].items()
        if not os.path.exists(os.path.join(out, p)) or sha256(os.path.join(out, p)) != m["sha256"]
    ]
    n = len(man["files"])
    print(f"{man['dataset']} built {man['built_at']}: {n - len(bad)}/{n} OK")
    for p in bad[:20]:
        print("  MISMATCH/MISSING:", p)
    sys.exit(1 if bad else 0)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(settings.data_dir / SLUG))
    ap.add_argument("--src", help="локальне дзеркало PSI-39 (about.json, catalog.csv, files/)")
    ap.add_argument("--videos", type=float, default=0, help="mp4 до N МБ (0 = не брати)")
    ap.add_argument("--no-docs", action="store_true")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--verify", action="store_true", help="перевірити знімок за manifest.json")
    a = ap.parse_args()
    out = a.out
    if a.verify:
        verify(out)
    os.makedirs(out, exist_ok=True)

    print("1/6 метадані та дерево файлів…", flush=True)
    meta, files = load_tree(a.src)
    with open(os.path.join(out, "about.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1, default=str)
    print(f"   {len(files)} файлів, {sum(f['bytes'] for f in files) / 1e9:.0f} ГБ у PSI")

    def content(f: dict) -> bytes:
        if f.get("src_path") and os.path.exists(f["src_path"]):
            with open(f["src_path"], "rb") as fh:
                return fh.read()
        return http(signed_url(f["name"], f["version"]))

    print("2/6 зведення тестів (xlsx) і таблиця PSI…", flush=True)
    xf = next(f for f in files if SUMMARY_XLSX in f["name"] and f["name"].endswith(".xlsx"))
    tests = parse_summary(read_xlsx(content(xf)))
    et = next(f for f in files if f["category"] == "Experimental table")
    psi = parse_psi_table(content(et).decode("utf-8-sig", errors="replace"))
    issues = cross_check(tests, psi)
    print(f"   {len(tests)} тестів у xlsx, {len(psi)} у таблиці PSI, розбіжностей: {len(issues)}")
    for s in issues:
        print("   ≠", s)
    if missing := sorted(set(psi) - {t["test_no"] for t in tests}):
        print(f"   у таблиці PSI, але не в xlsx: {missing}")
    by_no = {t["test_no"]: t for t in tests}
    by_cir: dict[str, int] = {}
    for t in tests:
        by_cir.setdefault(t["cir_id"], t["test_no"])

    print("3/6 прив'язка файлів до тестів…", flush=True)
    for f in files:
        f["kind"], cam = classify(f["name"])
        f["camera"] = cam or ""
        tno, how = bind(f, by_no, by_cir)
        f["test_no"], f["match"] = tno or "", how
        f["cir_id"] = by_no[tno]["cir_id"] if tno else ""
    unbound = [f for f in files if f["category"] == "Raw Data" and not f["test_no"]]
    n_bound = sum(1 for f in files if f["test_no"])
    print(f"   прив'язано {n_bound}, без тесту в Raw Data: {len(unbound)}")
    idx_cols = ["test_no", "cir_id", "match", "category", "kind", "camera", "name", "bytes",
                "version", "subfolder", "key"]  # fmt: skip
    write_csv(
        os.path.join(out, "test_files.csv"),
        idx_cols,
        sorted(files, key=lambda f: (str(f["test_no"]).zfill(5), f["kind"], f["name"])),
    )
    for t in tests:
        fs = [f for f in files if f["test_no"] == t["test_no"]]
        kinds = {f["kind"] for f in fs if f["name"] not in KNOWN_BAD}
        for k in ("droplet", "flame_color", "cool_flame", "radiometer", "chamber"):
            t[f"has_{k}_ts"] = f"{k}_ts" in kinds
        t["has_testsheet"] = "testsheet_txt" in kinds
        t["has_summary_pdf"] = "summary_pdf" in kinds
        vids = [f for f in fs if f["kind"] == "video"]
        t["n_videos"] = len(vids)
        t["min_video_mb"] = round(min(v["bytes"] for v in vids) / 1e6, 1) if vids else None
        zips = (f["bytes"] for f in fs if f["kind"] == "camera_images_zip")
        t["image_zips_gb"] = round(sum(zips) / 1e9, 2)
        t["n_files_psi"] = len(fs)

    print("4/6 легкі файли…", flush=True)
    jobs = []
    for f in files:
        if f["restricted"] or f["name"] in KNOWN_BAD:
            continue
        tdir = f"{f['test_no']:04d}" if f["test_no"] else ""
        if tdir and f["kind"] in LIGHT_KINDS:
            jobs.append((f, os.path.join(out, "raw", tdir, raw_name(f["name"]))))
        elif tdir and f["kind"] == "video" and a.videos and f["bytes"] <= a.videos * 1e6:
            jobs.append((f, os.path.join(out, "media", tdir, raw_name(f["name"]))))
        elif not a.no_docs and f["category"] in DOC_CATEGORIES:
            jobs.append(
                (f, os.path.join(out, "docs", f["category"], f["name"].replace(f"{ACC}_", "")))
            )
    print(f"   {len(jobs)} файлів, {sum(f['bytes'] for f, _ in jobs) / 1e6:.0f} МБ", flush=True)
    stats: dict[str, int] = {}
    with ThreadPoolExecutor(a.workers) as ex:
        futs = {
            ex.submit(fetch, f["name"], f["version"], d, f["bytes"], f.get("src_path")): f
            for f, d in jobs
        }
        for fu in as_completed(futs):
            try:
                r = fu.result()
            except Exception as e:  # noqa: BLE001 — продовжуємо, файл просто відсутній у знімку
                r = "fail"
                print(f"   FAIL {futs[fu]['name']}: {e}")
            stats[r] = stats.get(r, 0) + 1
    print(f"   {stats}")

    print("5/6 TestSheet і часові ряди…", flush=True)
    for t in tests:
        d = os.path.join(out, "raw", f"{t['test_no']:04d}")
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            p, low = os.path.join(d, fn), fn.lower()
            try:
                if low.endswith("_testsheet.txt"):
                    t.update(parse_testsheet(read_text(p)))
                elif low.endswith("_chamber_readings.txt"):
                    rows = parse_chamber(read_text(p))
                    write_csv(os.path.join(out, "timeseries", "chamber", f"{t['test_no']:04d}.csv"),
                              CHAMBER_COLS, rows)  # fmt: skip
                else:
                    for suffix, (kind, cols) in TIMESERIES.items():
                        if low.endswith(suffix):
                            _, rows = parse_tsv(read_text(p))
                            dest = os.path.join(out, "timeseries", kind, f"{t['test_no']:04d}.csv")
                            # на нитці DropletData має лише t і d (без позиції) → доповнюємо
                            pad = [None] * len(cols)
                            write_csv(dest, cols, [(r + pad)[: len(cols)] for r in rows])
            except Exception as e:  # noqa: BLE001
                print(f"   parse error test {t['test_no']} {fn}: {e}")

    print("6/6 tests.csv, БД, manifest…", flush=True)
    cols = [
        "test_no", "cir_id", "test_date", "test_time_local", "fuel", "x_dodecane", "fuel_raw",
        "p_atm", "x_o2", "x_n2", "x_he", "diluent", "fiber", "d0_mm", "dext_hot_mm", "k_hot_mm2_s",
        "k_cool_mm2_s", "dext_cool_mm", "reignitions", "cool_flame_extrapolated",
        "hot_flame_burn_time_s", "peak_hot_flame_rad_w", "peak_water_vapor_rad_w",
        "analysis_completed", "ignition_power_w", "ignition_time_ms", "in_psi_table",
        "ts_pressure_atm", "ts_temperature_k", "ts_fiber", "ts_kavg_mm2_s", "ts_d0_mm",
        "ts_dext_mm", "has_testsheet", "has_droplet_ts", "has_flame_color_ts", "has_cool_flame_ts",
        "has_radiometer_ts", "has_chamber_ts", "has_summary_pdf", "n_videos", "min_video_mb",
        "image_zips_gb", "n_files_psi", "comment", "ts_comment",
    ]  # fmt: skip
    write_csv(os.path.join(out, "tests.csv"), cols, tests)
    for kind in TS_KINDS:
        merge_timeseries(out, kind)
    build_duckdb(out)
    write_manifest(out, meta, tests, files)


def merge_timeseries(out: str, kind: str) -> None:
    """timeseries/<kind>/NNNN.csv → timeseries/<kind>_all.csv з колонкою test_no."""
    parts = sorted(glob.glob(os.path.join(out, "timeseries", kind, "*.csv")))
    if not parts:
        return
    with open(
        os.path.join(out, "timeseries", f"{kind}_all.csv"), "w", newline="", encoding="utf-8"
    ) as fo:
        w, header = csv.writer(fo), None
        for p in parts:
            tno = int(os.path.basename(p).split(".")[0])
            with open(p, encoding="utf-8") as fi:
                r = csv.reader(fi)
                h = next(r, None)
                if h is None:
                    continue
                if header is None:
                    header = h
                    w.writerow(["test_no", *h])
                for row in r:
                    w.writerow([tno, *row])


def build_duckdb(out: str) -> None:
    try:
        import duckdb
    except ImportError:
        print("   (duckdb не встановлено — БД пропущено)")
        return
    dbp = os.path.join(out, f"{SLUG}.duckdb")
    if os.path.exists(dbp):
        os.remove(dbp)
    o = out.replace("\\", "/")
    with duckdb.connect(dbp) as con:
        con.execute(
            f"CREATE TABLE tests AS SELECT * FROM read_csv_auto('{o}/tests.csv', header=true)"
        )
        con.execute(
            f"CREATE TABLE test_files AS SELECT * FROM "
            f"read_csv_auto('{o}/test_files.csv', header=true, all_varchar=true)"
        )
        for kind in TS_KINDS:
            g = f"{o}/timeseries/{kind}_all.csv"
            if os.path.exists(g):
                con.execute(
                    f"CREATE TABLE ts_{kind} AS SELECT * FROM read_csv_auto('{g}', header=true)"
                )
    print(f"   DuckDB: {dbp}")


def write_manifest(out: str, meta: dict, tests: list[dict], files: list[dict]) -> None:
    manifest = {
        "dataset": DATASET_VERSION,
        "source": f"NASA PSI {ACC} (CFI)",
        "doi": meta.get("doi"),
        "license": meta.get("licenseIdentifier"),
        "psi_version": meta.get("version"),
        "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "n_tests": len(tests),
        "n_psi_files": len(files),
        "files": {},
    }
    for root, _, fns in os.walk(out):
        for fn in fns:
            if fn.endswith((".part", ".duckdb", ".wal")) or fn == "manifest.json":
                continue
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, out).replace("\\", "/")
            manifest["files"][rel] = {"bytes": os.path.getsize(p), "sha256": sha256(p)}
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    print(f"Готово: {out}  ({len(manifest['files'])} файлів)")


if __name__ == "__main__":
    main()
