"""Автоматичні перевірки агента на evalsets/agent_psi69.jsonl з бюджетом. Витрачає гроші!

    uv run python -m flame.agent.eval [--budget 1.0] [--only id1,id2]

Перевірки на кожне питання:
- цитати є (крім off_topic), сегментів «No source» немає;
- кожне десяткове число в процитованому сегменті є в дослівних цитатах його джерел;
- очікувані тести серед джерел (`expect_tests`, `min_test_hits`), очікувані URL (`expect_url_any`);
- у тексті є одна з фраз `mention_any` (регістр не важливий);
- off_topic: жодних джерел, ввічлива відмова.
Витрати пишуться в журнал $DATA_DIR/agent_spend.json; прогін зупиняється на `--budget`.
"""

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any

import anthropic

from flame.agent import loop
from flame.agent.citations import numbers
from flame.agent.limits import ledger_add, ledger_total
from flame.agent.router import client
from flame.agent.schemas import HistoryTurn
from flame.core.config import settings
from flame.db.duckdb import get_connection

EVALSET = Path(__file__).parent / "evalsets" / "agent_psi69.jsonl"
LEDGER = settings.data_dir / "agent_spend.json"
DEV_BUDGET = 10.0
_NUM = re.compile(r"(?<![\w.])\d+\.\d+(?![\w.])")
_TEST_URL = re.compile(r"/tests/(\d+)|/raw/(\d{3})/")


def _cited_tests(sources: list[dict[str, Any]]) -> set[int]:
    out = set()
    for s in sources:
        for m in _TEST_URL.finditer(s["url"]):
            out.add(int(m.group(1) or m.group(2)))
        out.update(int(n) for n in re.findall(r"FLEX-(\d+)", s["title"]))
    return out


def _numbers_ok(answer: dict[str, Any], question: str) -> list[str]:
    """Числа з процитованих сегментів, яких немає в цитатах їхніх джерел (і в питанні)."""
    question_numbers = numbers(question)
    quotes = {s["n"]: " ".join(s["quotes"]) for s in answer["sources"]}
    bad = []
    for seg in answer["segments"]:
        if not seg["cites"]:
            continue
        text = " ".join(quotes.get(n, "") for n in seg["cites"])
        have = {float(x) for x in _NUM.findall(text)}
        for x in _NUM.findall(seg["text"]):
            if float(x) in question_numbers:
                continue
            if not any(abs(float(x) - h) < 1e-6 for h in have) and x not in text:
                bad.append(x)
    return bad


def check(case: dict[str, Any], done: dict[str, Any], ui: dict[str, list]) -> list[str]:
    ans = done["answer"]
    text = "".join(s["text"] for s in ans["segments"])
    srcs = ans["sources"]
    fails = []
    if case.get("expect_proposal"):
        acts = [p["action"] for p in ui["proposal"]]
        if case["expect_proposal"] not in acts:
            fails.append(f"no {case['expect_proposal']} proposal (got {acts})")
    if case.get("expect_highlight") and not ui["highlight"]:
        fails.append("no highlight")
    if case.get("expect_frame") and not ui["frame"]:
        fails.append("no camera frame shown")
    if case.get("expect_chart"):
        kinds = [c["kind"] for c in ui["chart"]]
        if case["expect_chart"] not in kinds:
            fails.append(f"no {case['expect_chart']} chart (got {kinds})")
    if case.get("off_topic"):
        if srcs:
            fails.append("off-topic answer has sources")
        if not re.search(r"FLEX|only help", text, re.I):
            fails.append("off-topic answer does not redirect to FLEX")
        return fails
    if not srcs and not case.get("allow_no_sources"):
        fails.append("no citations")
    if srcs and len(srcs) < case.get("min_sources", 1):
        fails.append(f"fewer than {case['min_sources']} sources")
    uncited = [s["text"].strip()[:70] for s in ans["segments"] if s["uncited"]]
    if uncited:
        fails.append(f"No source: {uncited[:3]}")
    bad = _numbers_ok(ans, case["q"])
    if bad:
        fails.append(f"numbers not in cited text: {sorted(set(bad))[:5]}")
    if case.get("expect_tests"):
        hits = _cited_tests(srcs) & set(case["expect_tests"])
        if len(hits) < case.get("min_test_hits", 1):
            fails.append(f"expected tests cited {sorted(hits)} of {case['expect_tests']}")
    if case.get("expect_url_any") and not any(
        k in s["url"] for s in srcs for k in case["expect_url_any"]
    ):
        fails.append(f"no source url containing {case['expect_url_any']}")
    if case.get("mention_any") and not any(m.lower() in text.lower() for m in case["mention_any"]):
        fails.append(f"none of {case['mention_any']} mentioned")
    return fails


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", type=float, default=1.0, help="стеля $ на прогін")
    ap.add_argument("--only", default="", help="ids через кому")
    args = ap.parse_args()
    if not settings.anthropic_api_key:
        raise SystemExit("ANTHROPIC_API_KEY is not set (backend/.env)")
    cases = [json.loads(line) for line in EVALSET.read_text().splitlines() if line.strip()]
    if args.only:
        keep = set(args.only.split(","))
        cases = [c for c in cases if c["id"] in keep]

    cur = get_connection().cursor()
    spent, passed, rows = 0.0, 0, []
    for case in cases:
        if spent >= args.budget or ledger_total(LEDGER) >= DEV_BUDGET:
            print(f"  STOP: budget reached (run ${spent:.3f}, dev ${ledger_total(LEDGER):.2f})")
            break
        turn = HistoryTurn(role="user", text=case["q"], page_context=case.get("page_context"))
        t0 = time.time()
        try:
            ui: dict[str, list] = {"proposal": [], "highlight": [], "chart": [], "frame": []}
            done = None
            for e in loop.run_turn(client(), cur, [turn], settings):
                if e["event"] in ui:
                    ui[e["event"]].append(e["data"])
                elif e["event"] == "done":
                    done = e["data"]
            assert done is not None
        except anthropic.APIError as e:  # мережа/API: питання пропускаємо, прогін триває
            print(f"  ERR  {case['id']:24} {type(e).__name__}")
            continue
        spent += done["cost_usd"]
        ledger_add(LEDGER, done["cost_usd"], f"eval:{case['id']}")
        fails = check(case, done, ui)
        passed += not fails
        status = "ok  " if not fails else "FAIL"
        rows.append((case["id"], done["duration_s"], done["cost_usd"], done["rewritten"]))
        print(
            f"  {status} {case['id']:24} {time.time() - t0:5.1f}s ${done['cost_usd']:.3f}"
            f"{' rewrite' if done['rewritten'] else ''}  {'; '.join(fails)}"
        )
    n = len(rows)
    if n:
        durations = sorted(r[1] for r in rows)
        print(
            f"\n{passed}/{n} passed · run ${spent:.3f} · median {durations[n // 2]:.1f}s · "
            f"max {durations[-1]:.1f}s · rewrites {sum(r[3] for r in rows)} · "
            f"dev total ${ledger_total(LEDGER):.2f}"
        )


if __name__ == "__main__":
    main()
