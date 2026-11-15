"""Оцінка якості пошуку на контрольному наборі питань.

    uv run python -m flame.rag.eval [--set psi69] [--k 5] [--with-examples]

Формат рядка `evalsets/<set>.jsonl`:
  {"q": "...", "expected": [{"test_no": 2}, {"source_path": "...", "page": 5}],
   "filters": {"test_nos": [2]}, "note": "..."}   # filters — необов'язково, як у search_docs
Питання влучне, якщо в top-k є чанк, що збігається з будь-яким `expected` за всіма його ключами
(test_no, source_path, page, source_type). Рядки з "example": true пропускаються.
"""

import argparse
import json
from pathlib import Path

from flame.db.duckdb import get_connection
from flame.rag import service
from flame.rag.schemas import Hit, SearchFilters

EVALSETS = Path(__file__).parent / "evalsets"


def matches(hit: Hit, expected: dict) -> bool:
    return all(getattr(hit, key) == value for key, value in expected.items())


def first_rank(hits: list[Hit], expected: list[dict]) -> int | None:
    for rank, hit in enumerate(hits, start=1):
        if any(matches(hit, e) for e in expected):
            return rank
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", default="psi69")
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--with-examples", action="store_true", help="рахувати й рядки-приклади")
    ap.add_argument("--no-rerank", action="store_true", help="без cross-encoder (для порівняння)")
    args = ap.parse_args()

    lines = (EVALSETS / f"{args.set}.jsonl").read_text(encoding="utf-8").splitlines()
    cases = [json.loads(line) for line in lines if line.strip()]
    cases = [c for c in cases if args.with_examples or not c.get("example")]
    if not cases:
        raise SystemExit(f"{args.set}: немає питань (крім прикладів). Додайте їх у evalsets/.")

    cur = get_connection().cursor()
    found, rr = 0, 0.0
    for c in cases:
        filters = SearchFilters(**c["filters"]) if c.get("filters") else None
        hits = service.search(cur, c["q"], args.k, filters, rerank=not args.no_rerank)
        rank = first_rank(hits, c["expected"])
        if rank:
            found += 1
            rr += 1 / rank
            print(f"  ok  @{rank}  {c['q']}")
        else:
            print(f"  MISS     {c['q']}")
            for h in hits:
                print(f"           got: {h.citation}")
    n = len(cases)
    print(f"\n{args.set}: recall@{args.k} = {found / n:.2f} ({found}/{n}), MRR = {rr / n:.2f}")


if __name__ == "__main__":
    main()
