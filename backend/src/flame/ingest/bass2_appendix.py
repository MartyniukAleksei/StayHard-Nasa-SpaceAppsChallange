"""Журнал тестів BASS-II з Додатку A звіту NASA/TM-20210011385 → studies/bass2/appendix_a.json.

    uv run --with pdfplumber python -m flame.ingest.bass2_appendix [--report PATH]

Офлайн. У PSI повний журнал тестів є лише таблицями всередині PDF-звіту (табл. A.1–A.6,
с. 103–113): тип потоку (Opposed / Concurrent / Stagnation), час горіння, запальник,
сирий і калібрований O₂ і головне — спостереження дослідників, з яких видно результат
тесту. У `bass2.tests` (CSV PSI) цього немає. Плюс табл. 5.1 (Miller, с. 57) і 7.1
(T'ien, с. 96). Результат комітиться (кілька десятків KB), API лише читає його, як
studies/catalog.json. `pdfplumber` потрібен лише цьому скрипту, тому не в залежностях.

Звірка з `bass2.tests` — tests/test_bass2.py. Розмітка результатів — bass2_outcomes.py.
"""

import argparse
import json
import re
from pathlib import Path
from typing import Any

from flame.core.config import settings
from flame.ingest.bass2_outcomes import FLOW_FILL, OUTCOMES, TIEN_REUSED

REPORT = "docs/Reports/Reports_BASS-II Summary Report.pdf"
OUT = Path(__file__).resolve().parents[1] / "studies" / "bass2" / "appendix_a.json"
PAGE_OFFSET = 8  # сторінка PDF = друкована сторінка звіту + 8
APPENDIX_PDF_PAGES = range(111, 122)  # друковані с. 103–113
MILLER_PDF_PAGE, TIEN_PDF_PAGE = 65, 104  # друковані с. 57 і 96

# 35 колонок табл. A.1–A.6 у порядку звіту (заголовки однакові в усіх шести таблицях).
# Колонка 9 у звіті підписана «Sample distance», але містить тип потоку.
COLS = (
    "date_raw", "time_raw", "as_run_no", "test_id", "sample_no", "material", "igniter",
    "flow_restrictor", "flow_config", "fan_display", "air_display", "radiometer_gain",
    "radiometer_display", "gn2_pot", "gn2_display", "filter", "release_mode", "exposure_mode",
    "exposure_comp", "bracket", "shutter_speed", "f_stop", "iso", "shutter_hold", "sd_card",
    "total_frames", "o2_cal_initial_pct", "o2_cal_final_pct", "o2_raw_initial_pct",
    "o2_raw_final_pct", "co2_initial_pct", "co2_final_pct", "co_initial_ppm", "co_final_ppm",
    "observations",
)  # fmt: skip
KEEP = (
    "test_id", "as_run_no", "date_raw", "time_raw", "sample_no", "material", "igniter",
    "flow_restrictor", "fan_display", "air_display", "radiometer_gain", "total_frames",
    "o2_cal_initial_pct", "o2_cal_final_pct", "o2_raw_initial_pct", "o2_raw_final_pct",
    "co2_initial_pct", "co2_final_pct", "co_initial_ppm", "co_final_ppm", "observations",
)  # fmt: skip
FLOW_CONFIGS = ("Opposed", "Concurrent", "Stagnation")
TABLES = "BFPMOT"  # порядок таблиць A.1–A.6 за першою літерою test_id
TEST_ID = re.compile(r"[BFMOPT]\d{1,2}[ab]?")
NUM = r"\d+(?:\.\d+)?"
EMPTY = re.compile(r"^[-–—]*$")


def _clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def _value(s: str) -> str | None:
    """Порожні клітинки звіту (`---`, `NA`) → None; мінус `–` → `-`."""
    s = s.replace("–", "-")
    return None if EMPTY.match(s) or s == "NA" else s


def parse_appendix_tables(pdf: Any) -> list[dict[str, Any]]:
    """Рядки тестів з табл. A.1–A.6. Один тест займає кілька фізичних рядків таблиці."""
    rows: list[dict[str, Any]] = []
    for pdf_page in APPENDIX_PDF_PAGES:
        tables = pdf.pages[pdf_page - 1].extract_tables()
        if not tables:
            continue
        cur: dict[str, Any] | None = None
        anchors: list[int] = []
        for r in tables[0][1:]:  # [0] — повернутий заголовок
            if any(c and TEST_ID.fullmatch(_clean(c)) for c in r[2:9]):
                anchors = [i for i, c in enumerate(r) if c is not None]
                cur = {"pdf_page": pdf_page, "cells": [_clean(r[i]) for i in anchors]}
                rows.append(cur)
            elif cur is not None:
                for i, c in enumerate(r):
                    c = _clean(c)
                    if c:
                        k = max(j for j, a in enumerate(anchors) if a <= i)
                        cur["cells"][k] = f"{cur['cells'][k]} {c}".strip()
    out = []
    for r in rows:
        if len(r["cells"]) != len(COLS):
            raise ValueError(f"page {r['pdf_page']}: {len(r['cells'])} cells, want {len(COLS)}")
        out.append({"pdf_page": r["pdf_page"], **dict(zip(COLS, r["cells"], strict=True))})
    return out


def build_tests(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ids = {r["test_id"] for r in raw}
    if ids != set(OUTCOMES):
        raise ValueError(f"outcomes mismatch: {sorted(ids ^ set(OUTCOMES))}")
    tests = []
    for r in raw:
        tid = r["test_id"]
        flow = r["flow_config"] if r["flow_config"] in FLOW_CONFIGS else FLOW_FILL.get(tid)
        outcome, confidence, note = OUTCOMES[tid]
        tests.append(
            {
                **{k: _value(r[k]) for k in KEEP},
                "table": f"A.{TABLES.index(tid[0]) + 1}",
                "report_page": r["pdf_page"] - PAGE_OFFSET,
                "pdf_page": r["pdf_page"],
                "flow_config": flow,
                "flow_config_raw": r["flow_config"],
                "flow_config_derived": flow is not None and flow != r["flow_config"],
                "outcome": outcome,
                "outcome_confidence": confidence,
                "outcome_note": note or None,
                "reused_sample": tid in TIEN_REUSED,
            }
        )
    return sorted(tests, key=lambda t: (t["table"], _sort_key(t["test_id"])))


def _sort_key(test_id: str) -> tuple[int, str]:
    m = re.match(r"[A-Z](\d+)(.*)", test_id)
    return (int(m.group(1)), m.group(2)) if m else (0, test_id)


def _page_text(reader: Any, pdf_page: int) -> list[str]:
    return [ln.strip() for ln in reader.pages[pdf_page - 1].extract_text().splitlines()]


def parse_miller_table(reader: Any) -> list[dict[str, Any]]:
    """Табл. 5.1: товщина, ширина, 1/2 сторони, швидкості потоку і поширення, час горіння."""
    rows = []
    for line in _page_text(reader, MILLER_PDF_PAGE):
        tok = line.split(" ")
        if not re.fullmatch(r"M\d+", tok[0]) or len(tok) < 8:
            continue
        mid = " ".join(tok[4:-3])
        if "Not tracked" in mid:
            vel, spread = re.findall(NUM, mid.split("Not tracked")[0]), []
        else:
            ns = re.findall(NUM, mid)
            vel, spread = ns[: len(ns) // 2], ns[len(ns) // 2 :]
        rows.append(
            {
                "test_id": tok[0],
                "thickness_mm": float(tok[1]),
                "width_cm": float(tok[2]),
                "sides_burning": int(tok[3]),
                "velocities_cm_s": [float(v) for v in vel],
                "spread_rates_mm_s": [float(v) for v in spread] or None,
                "burn_time_min": float(tok[-3]),
                "o2_initial_pct": float(tok[-2]),
                "o2_final_pct": float(tok[-1]),
            }
        )
    return rows


def parse_tien_table(reader: Any) -> list[dict[str, Any]]:
    """Табл. 7.1: вердикт PI для тканини SIBAL. 4 рядки — BASS-I з тими самими номерами!"""
    rows = []
    pat = re.compile(rf"^GMT(\d+)-(T\d+[ab]?) ({NUM}) ({NUM})(?: to ({NUM}))? ({NUM})b? (.*)$")
    for line in _page_text(reader, TIEN_PDF_PAGE):
        m = pat.match(line)
        if not m:
            continue
        gmt, tid, width, f0, f1, o2, comment = m.groups()
        comment = "" if EMPTY.match(comment.strip()) else comment.strip()
        rows.append(
            {
                "test_id": tid,
                "campaign": "BASS" if comment == "BASS" else "BASS-II",
                "gmt_day": int(gmt),
                "width_cm": float(width),
                "flow_start_cm_s": float(f0),
                "flow_end_cm_s": float(f1 or f0),
                "o2_pct": float(o2),
                "comment": comment or None,
            }
        )
    return rows


def main() -> None:
    import pdfplumber
    from pypdf import PdfReader

    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--report", type=Path, default=settings.study_dir("bass2") / REPORT)
    args = ap.parse_args()
    with pdfplumber.open(args.report) as pdf:
        tests = build_tests(parse_appendix_tables(pdf))
    reader = PdfReader(args.report)
    out = {
        "source": {
            "report": "NASA/TM-20210011385, BASS-II Summary Report (October 2021)",
            "file": REPORT,
            "page_offset": PAGE_OFFSET,
            "appendix_pages": "103-113",
        },
        "tests": tests,
        "miller_table_5_1": parse_miller_table(reader),
        "tien_table_7_1": parse_tien_table(reader),
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n_m, n_t = len(out["miller_table_5_1"]), len(out["tien_table_7_1"])
    print(f"{OUT}: {len(tests)} tests, table 5.1: {n_m} rows, table 7.1: {n_t} rows")


if __name__ == "__main__":
    main()
