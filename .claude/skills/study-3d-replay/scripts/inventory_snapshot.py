#!/usr/bin/env python3
"""Inventory of a study snapshot (data/<slug>/): what a 3D replay can honestly be built from.

Stdlib only. Read-only: it never writes into the snapshot.

    python .claude/skills/study-3d-replay/scripts/inventory_snapshot.py data/flex
    python .claude/skills/study-3d-replay/scripts/inventory_snapshot.py data/cfi --test 1250
    python .claude/skills/study-3d-replay/scripts/inventory_snapshot.py data/flex --json > /tmp/inv.json

Reports:
  * tests.csv: row count, columns, value counts of categorical columns (fuel, end_type, fiber …);
  * timeseries/<kind>/NNNN.csv: tests covered, columns, time range, share of empty cells per column;
  * per-test (--test N): every series for that test with its first/last rows, and its raw/ files.
Use the output to fill the "From the data" rows of the scene passport; anything not listed here
is not in the snapshot and cannot be drawn as measured.
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
from collections import Counter
from pathlib import Path

CATEGORICAL_HINTS = ("fuel", "end_type", "diluent", "fiber", "ts_fiber", "type", "kind", "phase")
MAX_FILES_SCANNED = 400  # per kind; enough for column stats without reading 500 MB


def read_csv(path: Path) -> tuple[list[str], list[list[str]]]:
    with path.open(newline="", encoding="utf-8", errors="replace") as f:
        rows = list(csv.reader(f))
    if not rows:
        return [], []
    return rows[0], rows[1:]


def to_float(v: str) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def tests_summary(snapshot: Path) -> dict:
    path = snapshot / "tests.csv"
    if not path.exists():
        return {"error": "tests.csv not found"}
    header, rows = read_csv(path)
    cats = {}
    for i, name in enumerate(header):
        if any(h in name.lower() for h in CATEGORICAL_HINTS):
            cats[name] = dict(Counter(r[i] if i < len(r) else "" for r in rows).most_common(12))
    empty = {
        name: round(sum(1 for r in rows if i >= len(r) or r[i].strip() == "") / max(1, len(rows)), 3)
        for i, name in enumerate(header)
    }
    return {"rows": len(rows), "columns": header, "categorical": cats, "empty_share": empty}


def kind_summary(kind_dir: Path) -> dict:
    files = sorted(p for p in kind_dir.glob("*.csv"))
    out: dict = {"tests": len(files), "columns": None, "t_s": None, "empty_share": {}, "points_per_test": None}
    if not files:
        return out
    empties: Counter = Counter()
    cells: Counter = Counter()
    t0s, t1s, counts = [], [], []
    columns: list[str] | None = None
    for p in files[:MAX_FILES_SCANNED]:
        header, rows = read_csv(p)
        if columns is None:
            columns = header
        elif header != columns:
            out.setdefault("column_variants", {}).setdefault(",".join(header), []).append(p.stem)
        counts.append(len(rows))
        if "t_s" in header:
            ti = header.index("t_s")
            ts = [t for t in (to_float(r[ti]) for r in rows if ti < len(r)) if t is not None]
            if ts:
                t0s.append(min(ts))
                t1s.append(max(ts))
        for i, name in enumerate(header):
            for r in rows:
                cells[name] += 1
                if i >= len(r) or r[i].strip() == "":
                    empties[name] += 1
    out["columns"] = columns
    out["empty_share"] = {k: round(empties[k] / cells[k], 3) for k in cells}
    if counts:
        out["points_per_test"] = {"min": min(counts), "median": statistics.median(counts), "max": max(counts)}
    if t0s:
        out["t_s"] = {
            "start_min": round(min(t0s), 3),
            "start_median": round(statistics.median(t0s), 3),
            "end_median": round(statistics.median(t1s), 3),
            "end_max": round(max(t1s), 3),
        }
    if len(files) > MAX_FILES_SCANNED:
        out["note"] = f"column stats from the first {MAX_FILES_SCANNED} of {len(files)} files"
    return out


def test_detail(snapshot: Path, test_no: int) -> dict:
    stem = f"{test_no:04d}"
    series = {}
    ts_root = snapshot / "timeseries"
    for kind_dir in sorted(p for p in ts_root.glob("*") if p.is_dir()):
        for cand in (kind_dir / f"{stem}.csv", kind_dir / f"{test_no}.csv"):
            if cand.exists():
                header, rows = read_csv(cand)
                series[kind_dir.name] = {
                    "file": str(cand.relative_to(snapshot)),
                    "columns": header,
                    "points": len(rows),
                    "first": rows[:2],
                    "last": rows[-2:],
                }
                break
    raw = []
    for cand in (snapshot / "raw" / stem, snapshot / "raw" / str(test_no)):
        if cand.is_dir():
            raw = sorted(str(p.relative_to(snapshot)) for p in cand.rglob("*") if p.is_file())
            break
    media = []
    for cand in (snapshot / "media" / stem, snapshot / "media" / str(test_no)):
        if cand.is_dir():
            media = sorted(str(p.relative_to(snapshot)) for p in cand.rglob("*") if p.is_file())
            break
    row = None
    tests_csv = snapshot / "tests.csv"
    if tests_csv.exists():
        header, rows = read_csv(tests_csv)
        if "test_no" in header:
            i = header.index("test_no")
            for r in rows:
                if r[i] in (str(test_no), stem):
                    row = dict(zip(header, r))
                    break
    return {"test_no": test_no, "tests_row": row, "series": series, "raw_files": raw, "media_files": media}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("snapshot", type=Path, help="study snapshot directory, e.g. data/flex")
    ap.add_argument("--test", type=int, help="also show everything for one test number")
    ap.add_argument("--json", action="store_true", help="print JSON instead of text")
    args = ap.parse_args()

    snap: Path = args.snapshot
    if not snap.is_dir():
        print(f"not a directory: {snap}. Get the snapshot first (docs/development.md → Дані).", file=sys.stderr)
        return 2

    report: dict = {"snapshot": str(snap)}
    about = snap / "about.json"
    if about.exists():
        try:
            a = json.loads(about.read_text(encoding="utf-8"))
            report["about"] = {k: a.get(k) for k in ("accession", "acronym", "title", "doi", "license") if k in a}
        except json.JSONDecodeError:
            report["about"] = "about.json is not valid JSON"
    report["tests"] = tests_summary(snap)
    ts_root = snap / "timeseries"
    report["timeseries"] = (
        {p.name: kind_summary(p) for p in sorted(ts_root.glob("*")) if p.is_dir()} if ts_root.is_dir() else {}
    )
    for sub in ("raw", "docs", "media"):
        d = snap / sub
        report[f"{sub}_files"] = sum(1 for p in d.rglob("*") if p.is_file()) if d.is_dir() else 0
    if args.test is not None:
        report["test"] = test_detail(snap, args.test)

    if args.json:
        json.dump(report, sys.stdout, ensure_ascii=False, indent=1)
        print()
        return 0

    print(f"# Snapshot {snap}")
    if isinstance(report.get("about"), dict):
        print("about:", ", ".join(f"{k}={v}" for k, v in report["about"].items()))
    t = report["tests"]
    if "error" in t:
        print("tests.csv:", t["error"])
    else:
        print(f"\n## tests.csv: {t['rows']} rows, {len(t['columns'])} columns")
        print("columns:", ", ".join(t["columns"]))
        for name, counts in t["categorical"].items():
            print(f"  {name}: {counts}")
        mostly_empty = [k for k, v in t["empty_share"].items() if v >= 0.5]
        if mostly_empty:
            print("  ≥50% empty:", ", ".join(mostly_empty))
    print("\n## timeseries")
    if not report["timeseries"]:
        print("  (none)")
    for kind, s in report["timeseries"].items():
        print(f"- {kind}: {s['tests']} tests; columns {s['columns']}")
        if s.get("t_s"):
            print(f"    t_s {s['t_s']}; points/test {s['points_per_test']}")
        holes = {k: v for k, v in s["empty_share"].items() if v > 0}
        if holes:
            print(f"    empty share: {holes}")
        if s.get("column_variants"):
            print(f"    other column sets: {list(s['column_variants'])}")
        if s.get("note"):
            print(f"    {s['note']}")
    print(f"\nraw files: {report['raw_files']}, docs files: {report['docs_files']}, media files: {report['media_files']}")
    if "test" in report:
        d = report["test"]
        print(f"\n## test {d['test_no']}")
        if d["tests_row"]:
            print("tests.csv:", {k: v for k, v in d["tests_row"].items() if v not in ("", None)})
        else:
            print("tests.csv: no row")
        for kind, s in d["series"].items():
            print(f"- {kind} ({s['file']}): {s['points']} points, columns {s['columns']}")
            print(f"    first {s['first']}  last {s['last']}")
        print("raw:", d["raw_files"] or "none")
        print("media:", d["media_files"] or "none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
