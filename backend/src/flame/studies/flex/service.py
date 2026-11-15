"""Логіка FLEX: фільтри, картка тесту, часові ряди, сусіди, детерміноване порівняння.

Кожен результат несе `sources` (flame.core.citations): агент передає їх у Claude API як
`search_result`, тож числа у відповіді цитують конкретний тест або файл.
"""

import math
from typing import Any

import duckdb

from flame.core.citations import Source, media_url, test_url, timeseries_url
from flame.core.config import settings
from flame.studies.flex import repository
from flame.studies.flex.fields import FIELDS, NEIGHBOR_FEATURES, SIGNALS
from flame.studies.flex.schemas import (
    Comparison,
    FieldDiff,
    FileRef,
    Filter,
    Neighbor,
    NeighborsResult,
    TestDetail,
    TestQueryResult,
    TestSummary,
    TimeSeries,
)

STUDY = "PSI-69"
MAX_LIMIT = 300
END_TYPE_NOTE = {
    "Disruption": "Disruption: self-extinction was not observed",
    "Completion": "Completion: the droplet burned out completely",
    "Extinction": "Extinction: the flame self-extinguished",
}


FIBER_CONFLICT_NOTE = (
    "Data conflict: the TestSheet fiber flag says no, but the researcher comment describes "
    "a fiber-supported droplet."
)


class NotFound(LookupError):
    pass


def test_name(test_no: int) -> str:
    return f"FLEX-{test_no:03d}"


def _fmt(v: Any, spec: str = ".3g", unit: str = "") -> str:
    if v is None:
        return "not recorded"
    if isinstance(v, float):
        return f"{v:{spec}}{unit}"
    return f"{v}{unit}"


def test_source(row: dict[str, Any]) -> Source:
    """Текст рядка таблиці для цитування: усі числа — як у БД, без обчислень."""
    n = row["test_no"]
    fiber = {True: "yes", False: "no", None: "not recorded"}[row.get("ts_fiber")]
    end = row.get("end_type")
    text = (
        f"Test {test_name(n)} (CIR {_fmt(row.get('cir_id'))}, {_fmt(row.get('test_date'))}): "
        f"fuel {_fmt(row.get('fuel'))}; pressure {_fmt(row.get('p_atm'), '.3f', ' atm')}; "
        f"O2 {_fmt(row.get('x_o2'), '.3f')}, N2 {_fmt(row.get('x_n2'), '.3f')}, "
        f"CO2 {_fmt(row.get('x_co2'), '.3f')}, He {_fmt(row.get('x_he'), '.3f')} "
        f"(mole fractions, diluent {_fmt(row.get('diluent'))}); "
        f"initial droplet diameter d0 {_fmt(row.get('d0_mm'), '.2f', ' mm')}; "
        f"extinction diameter {_fmt(row.get('dext_mm'), '.2f', ' mm')}; "
        f"burning rate constant K {_fmt(row.get('k_mm2_s'), '.3f', ' mm²/s')}; "
        f"burn time {_fmt(row.get('burn_time_s'), '.2f', ' s')}; "
        f"end type {END_TYPE_NOTE.get(end, _fmt(end))}; fiber-supported droplet: {fiber}."
    )
    if row.get("fiber_conflict"):
        text += f" {FIBER_CONFLICT_NOTE}"
    return Source(
        url=test_url(STUDY, n), title=f"{test_name(n)} — FLEX experiment table", text=text
    )


def _summary(row: dict[str, Any]) -> TestSummary:
    fields = {k: v for k, v in row.items() if k in TestSummary.model_fields}
    return TestSummary(**fields, url=test_url(STUDY, row["test_no"]))


def query_tests(
    cur: duckdb.DuckDBPyConnection,
    filters: list[Filter] | None = None,
    sort: str = "test_no",
    descending: bool = False,
    limit: int = 50,
) -> TestQueryResult:
    filters = filters or []
    limit = max(1, min(limit, MAX_LIMIT))
    rows = repository.query_tests(cur, filters, sort, descending, limit)
    return TestQueryResult(
        total=repository.count_tests(cur, filters),
        tests=[_summary(r) for r in rows],
        sources=[test_source(r) for r in rows],
    )


def _local_files(test_no: int) -> list[FileRef]:
    out = []
    for sub in ("raw", "media"):
        folder = settings.flex_dir / sub / f"{test_no:03d}"
        if not folder.is_dir():
            continue
        for p in sorted(folder.iterdir()):
            if p.is_file():
                rel = p.relative_to(settings.flex_dir).as_posix()
                out.append(
                    FileRef(
                        name=p.name, path=rel, bytes=p.stat().st_size, url=media_url(STUDY, rel)
                    )
                )
    return out


def get_test(cur: duckdb.DuckDBPyConnection, test_no: int) -> TestDetail:
    rows = repository.get_tests(cur, [test_no])
    if not rows:
        raise NotFound(f"{test_name(test_no)} not found")
    row = rows[0]
    sources = [test_source(row)]
    comment = (row.get("ts_comment") or "").strip()
    if comment:
        path = f"raw/{test_no:03d}/{test_name(test_no)}_TestSheet.txt"
        sources.append(
            Source(
                url=media_url(STUDY, path),
                title=f"{test_name(test_no)} TestSheet — researcher comment",
                text=comment,
            )
        )
    return TestDetail(
        test=row, files=_local_files(test_no), url=test_url(STUDY, test_no), sources=sources
    )


def _stat(rows: list[tuple], idx: int) -> tuple[float, float] | None:
    vals = [r[idx] for r in rows if r[idx] is not None]
    return (min(vals), max(vals)) if vals else None


def get_timeseries(
    cur: duckdb.DuckDBPyConnection, test_no: int, signal: str, max_points: int = 2000
) -> TimeSeries:
    if signal not in SIGNALS:
        raise NotFound(f"unknown signal {signal!r}; one of {list(SIGNALS)}")
    cols, rows = repository.timeseries(cur, test_no, signal)
    if not rows:
        raise NotFound(f"no {signal} time series for {test_name(test_no)}")
    step = max(1, math.ceil(len(rows) / max(1, max_points)))
    sampled = rows[::step]
    if sampled[-1] is not rows[-1]:
        sampled.append(rows[-1])  # кінцева точка (згасання) завжди в даних
    ranges = []
    for i, c in enumerate(cols[1:], start=1):
        st = _stat(rows, i)
        if st:
            ranges.append(f"{c} from {st[0]:.4g} to {st[1]:.4g}")
    first, last = (_fmt(rows[i][0], ".4g") for i in (0, -1))
    text = (
        f"{signal} time series of {test_name(test_no)}: {len(rows)} samples, "
        f"{cols[0]} from {first} to {last}; " + "; ".join(ranges) + "."
    )
    sources = [
        Source(
            url=timeseries_url(STUDY, test_no, signal),
            title=f"{test_name(test_no)} {signal} time series",
            text=text,
        )
    ]
    raw_suffix = SIGNALS[signal][2]
    if raw_suffix:
        path = f"raw/{test_no:03d}/{test_name(test_no)}_{raw_suffix}"
        if (settings.flex_dir / path).is_file():
            sources.append(
                Source(
                    url=media_url(STUDY, path),
                    title=f"{test_name(test_no)} raw file {raw_suffix}",
                    text=text,
                )
            )
    return TimeSeries(
        test_no=test_no,
        signal=signal,
        columns=cols,
        rows=[list(r) for r in sampled],
        n_total=len(rows),
        url=timeseries_url(STUDY, test_no, signal),
        sources=sources,
    )


def neighbors(cur: duckdb.DuckDBPyConnection, test_no: int, k: int = 5) -> NeighborsResult:
    """Найближчі за умовами тести того ж палива і того ж типу (нитка / вільна крапля).

    Відстань — евклідова в z-score по NEIGHBOR_FEATURES; це наша оцінка схожості.
    """
    rows = repository.all_tests(cur)
    by_no = {r["test_no"]: r for r in rows}
    if test_no not in by_no:
        raise NotFound(f"{test_name(test_no)} not found")
    target = by_no[test_no]
    stats = {}
    for f in NEIGHBOR_FEATURES:
        vals = [r[f] for r in rows if r[f] is not None]
        mean = sum(vals) / len(vals)
        sd = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals)) or 1.0
        stats[f] = (mean, sd)

    def dist(r: dict[str, Any]) -> float | None:
        acc = 0.0
        for f in NEIGHBOR_FEATURES:
            if r[f] is None or target[f] is None:
                return None
            acc += ((r[f] - target[f]) / stats[f][1]) ** 2
        return math.sqrt(acc)

    cands = []
    for r in rows:
        if r["test_no"] == test_no or r["fuel"] != target["fuel"] or r["fiber_conflict"]:
            continue
        if bool(r["ts_fiber"]) != bool(target["ts_fiber"]):
            continue
        d = dist(r)
        if d is not None:
            cands.append((d, r))
    cands.sort(key=lambda x: (x[0], x[1]["test_no"]))
    top = cands[:k]
    return NeighborsResult(
        test_no=test_no,
        features=NEIGHBOR_FEATURES,
        neighbors=[Neighbor(test=_summary(r), distance=round(d, 3)) for d, r in top],
        note=(
            "Similarity is our own estimate: same fuel and same fiber status, Euclidean "
            "distance of z-scored conditions " + ", ".join(NEIGHBOR_FEATURES) + "."
        ),
        sources=[test_source(target)] + [test_source(r) for _, r in top],
    )


COMPARE_FIELDS = [
    "fuel", "p_atm", "x_o2", "x_n2", "x_co2", "x_he", "diluent", "d0_mm", "dext_mm",
    "k_mm2_s", "burn_time_s", "end_type", "ts_fiber",
]  # fmt: skip


def compare_tests(cur: duckdb.DuckDBPyConnection, test_nos: list[int]) -> Comparison:
    """Детермінований diff параметрів. Різниці — відносно першого тесту в списку."""
    if len(test_nos) < 2:
        raise ValueError("need at least two tests to compare")
    rows = repository.get_tests(cur, test_nos)
    found = {r["test_no"]: r for r in rows}
    missing = [n for n in test_nos if n not in found]
    if missing:
        raise NotFound(f"not found: {', '.join(test_name(n) for n in missing)}")
    ordered = [found[n] for n in test_nos]
    first = ordered[0]
    diffs = []
    for f in COMPARE_FIELDS:
        values = {r["test_no"]: r[f] for r in ordered}
        diff = None
        if FIELDS[f].type == "number" and first[f] is not None:
            diff = {
                r["test_no"]: round(r[f] - first[f], 6) for r in ordered[1:] if r[f] is not None
            }
        diffs.append(FieldDiff(field=f, unit=FIELDS[f].unit, values=values, diff_vs_first=diff))

    warnings = [
        f"{test_name(r['test_no'])}: {FIBER_CONFLICT_NOTE}" for r in ordered if r["fiber_conflict"]
    ]
    fibers = {r["ts_fiber"] for r in ordered}
    if True in fibers and len(fibers) > 1:
        warnings.append(
            "Fiber-supported and free-floating droplets are mixed; they are not comparable."
        )
    if len({r["fuel"] for r in ordered}) > 1:
        warnings.append("Different fuels are compared.")
    if any(r["end_type"] == "Disruption" for r in ordered):
        warnings.append(END_TYPE_NOTE["Disruption"] + " (not 'would burn forever').")
    for r in ordered:
        gaps = [f for f in ("d0_mm", "k_mm2_s", "end_type") if r[f] is None]
        if gaps:
            warnings.append(f"{test_name(r['test_no'])}: missing {', '.join(gaps)}.")
    return Comparison(
        test_nos=test_nos,
        fields=diffs,
        warnings=warnings,
        sources=[test_source(r) for r in ordered],
    )
