"""
FLEX (PSI-69) dataset builder — Flame in Freefall, NASA Space Apps 2026.

Збирає ОДНАКОВИЙ для всієї команди знімок даних FLEX з публічного API NASA PSI:

  data/flex/
    manifest.json              версія знімка, дата, кількості, sha256 файлів
    tests.csv                  274 тести, нормалізовані колонки (+ розбір TestSheet, прапорці наявності даних)
    test_files.csv             індекс УСІХ ~6 500 файлів FLEX у PSI з прив'язкою до тесту (для доступу по API)
    timeseries/droplet/NNN.csv     t_s, d_mm, x_mm, y_mm           (DropletData.txt)
    timeseries/flame_color/NNN.csv t_s, flame_d_mm, standoff       (ColorCamData.txt)
    timeseries/flame_uv/NNN.csv    t_s, flame_d_mm, standoff, x, z (LLUVData.txt)
    timeseries/chamber/NNN.csv     timestamp, p_psia (PT16), T1..T4 (Chamber_Readings.txt)
    raw/NNN/...                оригінальні легкі файли тесту (txt, Summary.pdf тощо)
    docs/...                   інженерні/наукові документи, презентації
    media/NNN/...              (опційно) короткі mp4
    flex.duckdb                (опційно, якщо встановлено duckdb) — та сама БД для всіх

Запуск (з backend/; за замовчуванням пише в $DATA_DIR/flex, тобто <repo>/data/flex):
    uv run python -m flame.ingest.psi_flex                    # ~400 МБ, 10–30 хв
    uv run python -m flame.ingest.psi_flex --videos 60        # + mp4 до 60 МБ (≈23 тести)
    uv run python -m flame.ingest.psi_flex --only 2 30 45     # лише окремі тести (швидка перевірка)
    uv run python -m flame.ingest.psi_flex --index-only       # тільки tests.csv + test_files.csv
    uv run python -m flame.ingest.psi_flex --verify           # перевірка локальної копії за manifest.json

Дані: NASA PSI, CC0-1.0. Цитувати DOI FLEX (див. about.json).
"""
import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from flame.core.config import settings

ACC = "PSI-69"
API = "https://psi.nasa.gov/geode-py/ws"
UA = {"User-Agent": "Mozilla/5.0 (SpaceApps2026 flex-dataset)", "Accept": "application/json, text/plain, */*"}
DATASET_VERSION = "flex-v1"

# які сирі файли тесту вважаємо «легкими» і качаємо для всіх тестів
LIGHT_KINDS = {
    "testsheet_txt", "droplet_ts", "flame_color_ts", "flame_uv_ts", "summary_pdf", "testsheet_pdf",
    "results_pdf", "drophist_pdf", "other_pdf", "testpoint_log", "comments", "testpoint_settings",
    "camera_settings", "chamber_ts", "radiometer_ts", "camera_index_txt", "other_txt", "other_xls",
}


# ------------------------------------------------------------------ HTTP
def http(url, data=None, retries=4, timeout=120):
    body, headers = None, dict(UA)
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=timeout) as r:
                return r.read()
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(2 ** i)


def get_json(url, data=None):
    return json.loads(http(url, data))


def signed_url(name, version):
    q = urllib.parse.urlencode({"file": name, "version": version, "redirect": "false"})
    return http(f"{API}/studies/{ACC}/download?{q}").decode().strip().strip('"')


def download(name, version, dest, size=None):
    if os.path.exists(dest) and (size is None or os.path.getsize(dest) == size):
        return "skip"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    url = signed_url(name, version)
    tmp = dest + ".part"
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA["User-Agent"]}),
                                        timeout=600) as r, open(tmp, "wb") as out:
                while True:
                    ch = r.read(1 << 20)
                    if not ch:
                        break
                    out.write(ch)
            os.replace(tmp, dest)
            return "ok"
        except Exception:
            if i == 3:
                raise
            time.sleep(2 ** i)
            url = signed_url(name, version)


# ------------------------------------------------------------------ helpers
def num(x):
    if x is None:
        return None
    x = str(x).strip().replace("\x96", "").replace("–", "")
    try:
        return float(x)
    except ValueError:
        return None


def read_text(path):
    with open(path, "rb") as fh:
        raw = fh.read()
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(enc).replace("\r\n", "\n").replace("\r", "\n")
        except UnicodeDecodeError:
            continue


def flatten(nodes, top=None, out=None):
    out = [] if out is None else out
    for n in nodes:
        if n.get("directory") is False:
            out.append({
                "key": n["key"], "name": n["key"].rsplit("/", 1)[-1], "bytes": int(n.get("bytes_size") or 0),
                "category": n.get("sortingCategory") or top or "", "subfolder": (n.get("subcategory") or "").strip(),
                "version": n.get("version") or 1, "restricted": bool(n.get("restricted")),
            })
        if n.get("files"):
            flatten(n["files"], top or n.get("displayName"), out)
    return out


def classify(name):
    """Тип файлу FLEX за іменем. Повертає (kind, camera_letter|None)."""
    n = re.sub(r"^PSI-69_[^_]+_", "", name)
    e = n.rsplit(".", 1)[-1].lower() if "." in n else ""
    rules = [
        (r"_TestSheet\.txt$", "testsheet_txt"), (r"_TestSheet\.rtf$", "testsheet_rtf"),
        (r"TestSheet\.pdf$", "testsheet_pdf"), (r"_DropletData\.txt$", "droplet_ts"),
        (r"_ColorCamData\.txt$", "flame_color_ts"), (r"_LLUVData\.txt$", "flame_uv_ts"),
        (r"_Summary\.pdf$", "summary_pdf"), (r"_ResultsSummary\.pdf$", "results_pdf"),
        (r"_DropHist\.pdf$", "drophist_pdf"), (r"_Chamber_Readings\.txt$", "chamber_ts"),
        (r"_Radiometer_Readings\.txt$", "radiometer_ts"), (r"_Comments\.txt$", "comments"),
        (r"Testpo?i?n?t_Set+ings\.txt$", "testpoint_settings"), (r"Cam\w*_Set+ings\.txt$", "camera_settings"),
    ]
    for pat, kind in rules:
        if re.search(pat, n, re.I):
            return kind, None
    if e == "zip":
        m = re.search(r"([A-E])\.zip$", n, re.I)
        return "camera_images_zip", (m.group(1).upper() if m else None)
    if e in ("mp4", "mpg", "avi"):
        return "video", None
    if re.match(r"^[0-9A-Z]{6,8}[A-E]\.txt$", n, re.I):
        return "camera_index_txt", n[-5].upper()
    if re.match(r"^[0-9A-Z]{6,8}\.txt$", n, re.I):
        return "testpoint_log", None
    if e == "pdf":
        return "other_pdf", None
    if e == "txt":
        return "other_txt", None
    if e in ("xls", "xlsx"):
        return "other_xls", None
    return "other_" + (e or "bin"), None


# ------------------------------------------------------------------ parsing
TABLE_COLS = {
    "FLEX Test #": "test_no", "FLEX Identifier": "cir_id", "Test Date": "test_date", "Test GMT": "test_gmt",
    "Fuel": "fuel", "Ambient pressure; mmHg": "p_mmhg",
    "O initial ambient composition; mole fraction": "x_o2",
    "N initial ambient composition; mole fraction": "x_n2",
    "CO initial ambient composition; mole fraction": "x_co2",
    "He initial ambient composition; mole fraction": "x_he",
    "Droplet initial diameter; mm": "d0_mm", "Visible flame extinction diameter; mm": "dext_mm",
    "Burning rate; mm": "k_mm2_s", "Burn time; s": "burn_time_s", "Test end": "end_type",
}


def parse_table(text):
    rows = list(csv.reader(io.StringIO(text)))
    head = [h.strip() for h in rows[0]]
    out = []
    for r in rows[1:]:
        if not any(c.strip() for c in r):
            continue
        d = {TABLE_COLS.get(h, h): (r[i].strip() if i < len(r) else "") for i, h in enumerate(head)}
        t = {"test_no": int(num(d["test_no"])), "cir_id": d["cir_id"], "test_date": d["test_date"],
             "test_gmt": d["test_gmt"], "fuel": d["fuel"]}
        for k in ("p_mmhg", "x_o2", "x_n2", "x_co2", "x_he", "d0_mm", "dext_mm", "k_mm2_s", "burn_time_s"):
            t[k] = num(d.get(k))
        t["p_atm"] = round(t["p_mmhg"] / 760.0, 3) if t["p_mmhg"] else None
        s = sum(v for v in (t["x_o2"], t["x_n2"], t["x_co2"], t["x_he"]) if v)
        t["x_other"] = round(1 - s, 3) if s else None          # >0 → інший розбавник (напр. Xe), див. TestSheet
        dil = [n for n, k in (("CO2", "x_co2"), ("He", "x_he")) if t[k]]
        t["diluent"] = "+".join(dil) if dil else ("other" if (t["x_other"] or 0) > 0.02 else "N2")
        t["end_type"] = d["end_type"]
        out.append(t)
    return out


def parse_testsheet(text):
    info, comment = {}, []
    in_c = False
    for line in text.split("\n"):
        if line.strip().upper().startswith("COMMENTS"):
            in_c = True
            continue
        if in_c:
            comment.append(line.strip())
            continue
        m = re.match(r"\s*(.+?)\s*[=:]\s*(.+?)\s*$", line)
        if m:
            info[m.group(1).strip().lower()] = m.group(2).strip()
    g = lambda *ks: next((info[k] for k in info for kk in ks if k.startswith(kk)), None)
    return {
        "ts_pressure_atm": num(g("pressure (atm)")), "ts_temperature_k": num(g("temperature (k)")),
        "ts_xe": num(g("xe mole", "xenon")), "ts_fiber": g("fiber"), "ts_kavg_mm2_s": num(g("kavg")),
        "ts_d0_mm": num(g("d0")), "ts_dext_mm": num(g("dext")),
        "ts_comment": " ".join(c for c in comment if c).strip(),
    }


def parse_tsv(text):
    lines = [l for l in text.split("\n") if l.strip()]
    if not lines:
        return [], []
    head = [h.strip() for h in lines[0].split("\t")]
    rows = []
    for l in lines[1:]:
        v = [num(x) for x in l.split("\t")]
        if v and v[0] is not None:
            rows.append(v)
    return head, rows


def parse_chamber(text):
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return []
    head = rows[0]
    idx = {h: i for i, h in enumerate(head)}
    pick = [("p_psia", "FCU_MP_PT16(PSIA)"), ("T1_C", "FCU_MP_TM1(Deg C)"), ("T2_C", "FCU_MP_TM2(Deg C)"),
            ("T3_C", "FCU_MP_TM3(DegC)"), ("T4_C", "FCU_MP_TM4(DegC)")]
    out = []
    for r in rows[1:]:
        if not r:
            continue
        o = {"timestamp": r[0]}
        for k, h in pick:
            o[k] = num(r[idx[h]]) if h in idx and idx[h] < len(r) else None
        out.append(o)
    return out


def write_csv(path, header, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        for r in rows:
            w.writerow(["" if v is None else v for v in (r if isinstance(r, (list, tuple)) else [r.get(h) for h in header])])


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for ch in iter(lambda: fh.read(1 << 20), b""):
            h.update(ch)
    return h.hexdigest()


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(settings.flex_dir))
    ap.add_argument("--only", nargs="*", type=int, help="номери тестів (FLEX Test #)")
    ap.add_argument("--videos", type=float, default=0, help="качати mp4 до N МБ (0 = не качати)")
    ap.add_argument("--no-docs", action="store_true")
    ap.add_argument("--index-only", action="store_true")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--verify", action="store_true", help="перевірити локальну копію за manifest.json (без мережі)")
    a = ap.parse_args()
    out = a.out
    if a.verify:
        man = json.load(open(os.path.join(out, "manifest.json"), encoding="utf-8"))
        bad = [p for p, m in man["files"].items()
               if not os.path.exists(os.path.join(out, p)) or sha256(os.path.join(out, p)) != m["sha256"]]
        print(f"{man['dataset']} built {man['built_at']}: {len(man['files']) - len(bad)}/{len(man['files'])} OK")
        for p in bad[:20]:
            print("  MISMATCH/MISSING:", p)
        sys.exit(1 if bad else 0)
    os.makedirs(out, exist_ok=True)

    print("1/6 метадані та дерево файлів…", flush=True)
    meta = get_json(f"{API}/repo/investigations/{ACC}")
    with open(os.path.join(out, "about.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1, default=str)
    tree = get_json(f"{API}/files/v2", {"folder": "", "fileType": "study", "studyId": ACC,
                                        "version": meta.get("version", 1), "obfuscationcode": ""})
    files = flatten(tree.get("files") or [])
    print(f"   {len(files)} файлів, {sum(f['bytes'] for f in files) / 1e9:.0f} ГБ у PSI")

    print("2/6 таблиця експериментів…", flush=True)
    et = next(f for f in files if f["category"] == "Experimental table")
    tests = parse_table(http(signed_url(et["name"], et["version"])).decode("latin-1"))
    by_no = {t["test_no"]: t for t in tests}
    by_cir = {}
    for t in tests:
        by_cir.setdefault(t["cir_id"].upper(), t["test_no"])

    print("3/6 прив'язка файлів до тестів…", flush=True)
    for f in files:
        kind, cam = classify(f["name"])
        f["kind"], f["camera"] = kind, cam or ""
        tno, how = None, ""
        if f["category"] == "Raw Data":
            # У PSI файли інколи лежать не в тій папці (напр. Flex-008 містить файли тесту N05M201 = №218),
            # тому ім'я файлу має пріоритет над папкою.
            base = re.sub(r"^PSI-69_Raw Data_", "", f["name"])

            def cir_in(s):
                for tok in re.findall(r"[0-9A-Z]{6,9}", s.upper().replace("_", " ")):
                    for L in (7, 6, 8):
                        if tok[:L] in by_cir:
                            return by_cir[tok[:L]]
                return None

            m = re.match(r"FLEX[-_ ]?(\d{3,4})[_ ]", base, re.I)          # 1) FLEX-031_*.txt (не FLEX_10_Jun…)
            if m and int(m.group(1)) in by_no:
                tno, how = int(m.group(1)), "flex_name"
            elif cir_in(base):                                             # 2) 182F001_*.txt, 061F002A.zip
                tno, how = cir_in(base), "cir_name"
            elif cir_in(f["subfolder"]):                                   # 3) .../FLEX_089_..._053F001/
                tno, how = cir_in(f["subfolder"]), "cir_folder"
            else:                                                          # 4) .../Flex-031/
                m = re.search(r"(?:^|/)\s*Flex-(\d{1,4})\s*(?:/|$)", f["subfolder"], re.I)
                if m and int(m.group(1)) in by_no:
                    tno, how = int(m.group(1)), "folder"
        f["test_no"] = tno or ""
        f["cir_id"] = by_no[tno]["cir_id"] if tno else ""
        f["match"] = how
    idx_cols = ["test_no", "cir_id", "match", "category", "kind", "camera", "name", "bytes", "version", "subfolder", "key"]
    write_csv(os.path.join(out, "test_files.csv"), idx_cols, sorted(files, key=lambda f: (str(f["test_no"]).zfill(4), f["kind"], f["name"])))

    # агреговані прапорці на тест
    for t in tests:
        fs = [f for f in files if f["test_no"] == t["test_no"]]
        kinds = {f["kind"] for f in fs}
        t["has_droplet_ts"] = "droplet_ts" in kinds
        t["has_flame_color_ts"] = "flame_color_ts" in kinds
        t["has_flame_uv_ts"] = "flame_uv_ts" in kinds
        t["has_chamber_ts"] = "chamber_ts" in kinds
        t["has_summary_pdf"] = "summary_pdf" in kinds
        vids = [f for f in fs if f["kind"] == "video"]
        t["n_videos"] = len(vids)
        t["min_video_mb"] = round(min(v["bytes"] for v in vids) / 1e6, 1) if vids else None
        t["image_zips_gb"] = round(sum(f["bytes"] for f in fs if f["kind"] == "camera_images_zip") / 1e9, 2)
        t["n_files_psi"] = len(fs)

    sel_tests = set(a.only) if a.only else set(by_no)
    if not a.index_only:
        print("4/6 завантаження легких файлів…", flush=True)
        jobs = []
        for f in files:
            if f["restricted"]:
                continue
            if f["test_no"] in sel_tests and f["kind"] in LIGHT_KINDS:
                jobs.append((f, os.path.join(out, "raw", f"{f['test_no']:03d}", f["name"].replace("PSI-69_Raw Data_", ""))))
            elif f["test_no"] in sel_tests and f["kind"] == "video" and a.videos and f["bytes"] <= a.videos * 1e6:
                jobs.append((f, os.path.join(out, "media", f"{f['test_no']:03d}", f["name"].replace("PSI-69_Raw Data_", ""))))
            elif not a.no_docs and f["category"] in ("Engineering Documents", "Presentations", "Science Documents",
                                                     "Investigation Metadata Files", "Experimental table"):
                jobs.append((f, os.path.join(out, "docs", f["category"], f["name"].replace("PSI-69_", ""))))
        tot = sum(f["bytes"] for f, _ in jobs)
        print(f"   {len(jobs)} файлів, {tot / 1e6:.0f} МБ", flush=True)
        done = 0
        with ThreadPoolExecutor(a.workers) as ex:
            futs = {ex.submit(download, f["name"], f["version"], d, f["bytes"]): f for f, d in jobs}
            for fu in as_completed(futs):
                done += 1
                try:
                    fu.result()
                except Exception as e:
                    print(f"   FAIL {futs[fu]['name']}: {e}")
                if done % 100 == 0 or done == len(jobs):
                    print(f"   {done}/{len(jobs)}", flush=True)

        print("5/6 парсинг TestSheet і часових рядів…", flush=True)
        for t in tests:
            if t["test_no"] not in sel_tests:
                continue
            d = os.path.join(out, "raw", f"{t['test_no']:03d}")
            if not os.path.isdir(d):
                continue
            for fn in os.listdir(d):
                p = os.path.join(d, fn)
                low = fn.lower()
                try:
                    if low.endswith("_testsheet.txt"):
                        t.update(parse_testsheet(read_text(p)))
                    elif low.endswith("_dropletdata.txt"):
                        h, rows = parse_tsv(read_text(p))
                        write_csv(os.path.join(out, "timeseries", "droplet", f"{t['test_no']:03d}.csv"),
                                  ["t_s", "d_mm", "x_mm", "y_mm"], [r[:4] for r in rows])
                    elif low.endswith("_colorcamdata.txt"):
                        h, rows = parse_tsv(read_text(p))
                        write_csv(os.path.join(out, "timeseries", "flame_color", f"{t['test_no']:03d}.csv"),
                                  ["t_s", "flame_d_mm", "standoff"], [r[:3] for r in rows])
                    elif low.endswith("_lluvdata.txt"):
                        h, rows = parse_tsv(read_text(p))
                        write_csv(os.path.join(out, "timeseries", "flame_uv", f"{t['test_no']:03d}.csv"),
                                  ["t_s", "flame_d_mm", "standoff", "droplet_x_mm", "droplet_z_mm"], [r[:5] for r in rows])
                    elif low.endswith("_chamber_readings.txt"):
                        rows = parse_chamber(read_text(p))
                        write_csv(os.path.join(out, "timeseries", "chamber", f"{t['test_no']:03d}.csv"),
                                  ["timestamp", "p_psia", "T1_C", "T2_C", "T3_C", "T4_C"], rows)
                except Exception as e:
                    print(f"   parse error test {t['test_no']} {fn}: {e}")

    print("6/6 tests.csv, БД, manifest…", flush=True)
    cols = ["test_no", "cir_id", "test_date", "test_gmt", "fuel", "p_mmhg", "p_atm", "x_o2", "x_n2", "x_co2", "x_he",
            "x_other", "diluent", "d0_mm", "dext_mm", "k_mm2_s", "burn_time_s", "end_type",
            "ts_pressure_atm", "ts_temperature_k", "ts_xe", "ts_fiber", "ts_kavg_mm2_s", "ts_d0_mm", "ts_dext_mm",
            "has_droplet_ts", "has_flame_color_ts", "has_flame_uv_ts", "has_chamber_ts", "has_summary_pdf",
            "n_videos", "min_video_mb", "image_zips_gb", "n_files_psi", "ts_comment"]
    write_csv(os.path.join(out, "tests.csv"), cols, tests)

    # зведені часові ряди: один CSV на тип (test_no + колонки) — зручно для pandas і DuckDB
    import glob
    for kind in ("droplet", "flame_color", "flame_uv", "chamber"):
        parts = sorted(glob.glob(os.path.join(out, "timeseries", kind, "*.csv")))
        if not parts:
            continue
        with open(os.path.join(out, "timeseries", f"{kind}_all.csv"), "w", newline="", encoding="utf-8") as fo:
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
                        w.writerow(["test_no"] + h)
                    for row in r:
                        w.writerow([tno] + row)

    try:
        import duckdb  # noqa
        dbp = os.path.join(out, "flex.duckdb")
        if os.path.exists(dbp):
            os.remove(dbp)
        con = duckdb.connect(dbp)
        con.execute(f"CREATE TABLE tests AS SELECT * FROM read_csv_auto('{out}/tests.csv', header=true)")
        con.execute(f"CREATE TABLE test_files AS SELECT * FROM read_csv_auto('{out}/test_files.csv', header=true, all_varchar=true)")
        for kind in ("droplet", "flame_color", "flame_uv", "chamber"):
            g = os.path.join(out, "timeseries", f"{kind}_all.csv")
            if os.path.exists(g):
                con.execute(f"CREATE TABLE ts_{kind} AS SELECT * FROM read_csv_auto('{g}', header=true)")
        con.close()
        print(f"   DuckDB: {dbp}")
    except ImportError:
        print("   (duckdb не встановлено — БД пропущено; pip install duckdb)")

    manifest = {
        "dataset": DATASET_VERSION, "source": f"NASA PSI {ACC} (FLEX)", "doi": meta.get("doi"),
        "license": meta.get("licenseIdentifier"), "psi_version": meta.get("version"),
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "n_tests": len(tests), "n_psi_files": len(files), "tests_selected": sorted(sel_tests) if a.only else "all",
        "files": {},
    }
    for root, _, fns in os.walk(out):
        for fn in fns:
            if fn.endswith((".part", ".duckdb", ".wal")) or fn == "manifest.json":
                continue
            p = os.path.join(root, fn)
            manifest["files"][os.path.relpath(p, out)] = {"bytes": os.path.getsize(p), "sha256": sha256(p)}
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    print(f"Готово: {out}  ({len(manifest['files'])} файлів)")


if __name__ == "__main__":
    main()
