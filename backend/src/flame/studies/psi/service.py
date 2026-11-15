"""Логіка над таблицями інших досліджень PSI: огляд, пошук тестів, агрегати, тест, ряд.

Кожен результат несе `sources` (ADR 0006): рядки таблиці з посиланням на ендпоінт, з якого
їх можна отримати. Обчислені агрегати підписані як обчислені з таблиці.
"""

from datetime import date, datetime, time
from typing import Any
from urllib.parse import quote

import duckdb

from flame.core.citations import (
    Source,
    doi_url,
    study_series_url,
    study_test_url,
    study_tests_url,
    study_url,
)
from flame.core.studies import PSI_STUDIES, Study
from flame.studies.psi import repository as repo
from flame.studies.psi.notes import DEFAULT_COLUMNS, NOTES
from flame.studies.psi.repository import InvalidQuery
from flame.studies.psi.schemas import (
    AggregateResult,
    Filter,
    SeriesResult,
    StudyOverview,
    TestDetail,
    TestsResult,
)

TIME_COLUMNS = ("t_s", "timestamp", "elapsed_test_s", "unix_s", "epoch_time")


class NotFound(LookupError):
    pass


def study(cur: duckdb.DuckDBPyConnection, slug: str) -> Study:
    """Дослідження з реєстру, знімок якого є в цій збірці БД."""
    s = PSI_STUDIES.get(slug)
    if s is None:
        known = ", ".join(PSI_STUDIES)
        raise NotFound(f"unknown study {slug!r}; studies with tables: {known} (FLEX has its own)")
    if not repo.loaded(cur, slug):
        raise NotFound(f"{s.acronym} data is not loaded in this build of the database")
    return s


def fmt(v: Any) -> str:
    if v is None:
        return "not recorded"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float):
        if abs(v) >= 1e5:  # час епохи, лічильники — без експоненти
            return f"{v:.0f}" if v.is_integer() else f"{v:.3f}"
        return format(v, ".6g")
    if isinstance(v, datetime | date | time):
        return v.isoformat()
    return str(v)


def test_name(s: Study, test_id: Any) -> str:
    return f"{s.test_label} test {test_id}"


def _registry_row(cur: duckdb.DuckDBPyConnection, slug: str) -> dict[str, Any]:
    return next((r for r in repo.registry(cur) if r["slug"] == slug), {})


def _doi_source(s: Study, reg: dict[str, Any]) -> Source:
    doi = reg.get("doi") or ""
    return Source(
        url=doi_url(doi) if doi else study_url(s.slug),
        title=f"{s.acronym} ({s.accession}) dataset",
        text=(
            f"{reg.get('title') or s.acronym} ({s.acronym}, NASA PSI {s.accession}). "
            f"Dataset {reg.get('dataset') or 'n/a'}, license {reg.get('license') or 'n/a'}, "
            f"DOI {doi or 'n/a'}."
        ),
    )


def _series_columns(cur: duckdb.DuckDBPyConnection, s: Study, table: str) -> list[str]:
    cols = repo.columns(cur, s.slug, table)
    skip = {s.series_key, s.test_key, "test_no", "test_id", "run_no", "index"}
    return [c for c, t in cols.items() if repo.is_numeric(t) and c not in skip]


def overview(cur: duckdb.DuckDBPyConnection, slug: str) -> StudyOverview:
    s = study(cur, slug)
    reg = _registry_row(cur, slug)
    tables = repo.tables(cur, slug)
    profile = repo.column_profile(cur, slug, repo.columns(cur, slug, "tests"))
    series = {t[3:]: _series_columns(cur, s, t) for t in tables if t.startswith("ts_")}
    lines = []
    for c in profile:
        if "values" in c:
            vals = ", ".join(f"{k} ({n})" for k, n in c["values"].items())
            desc = f"values: {vals}"
        elif "min" in c:
            desc = f"range {fmt(c['min'])} to {fmt(c['max'])}"
        else:
            desc = f"{c['distinct']} distinct values"
        lines.append(f"- {c['column']} ({c['type']}), recorded for {c['non_null']} tests: {desc}")
    n_tests = tables.get("tests", 0)
    series_txt = "; ".join(
        f"{name} ({tables['ts_' + name]} rows; columns: {', '.join(cols)})"
        for name, cols in series.items()
    )
    table_src = Source(
        url=study_url(slug),
        title=f"{s.acronym} test table: columns and values",
        text=(
            f"The {s.acronym} test table has {n_tests} tests (key {s.test_key}). Columns:\n"
            + "\n".join(lines)
            + f"\nTime series: {series_txt or 'none in this dataset'}."
        ),
    )
    notes_src = Source(
        url=study_url(slug),
        title=f"{s.acronym}: notes on the data",
        text=" ".join(NOTES.get(slug, [])),
    )
    return StudyOverview(
        study=reg,
        tables=tables,
        test_columns=profile,
        series=series,
        notes=NOTES.get(slug, []),
        sources=[_doi_source(s, reg), table_src, notes_src],
    )


def _row_source(s: Study, row: dict[str, Any], columns: list[str]) -> Source:
    tid = row.get(s.test_key)
    text = "; ".join(f"{c} = {fmt(row.get(c))}" for c in columns if c != s.test_key)
    return Source(
        url=study_test_url(s.slug, tid),
        title=f"{test_name(s, tid)} ({s.acronym} test table)",
        text=f"{test_name(s, tid)}: {text}.",
    )


def _tests_query(filters: list[Filter]) -> str:
    parts = [f"{f.field}:{f.op}" + (f":{f.value}" if f.value not in (None, "") else "")
             for f in filters]  # fmt: skip
    return "&".join(f"f={quote(p, safe=':,')}" for p in parts)


def query_tests(
    cur: duckdb.DuckDBPyConnection,
    slug: str,
    filters: list[Filter],
    columns: list[str] | None = None,
    sort: str | None = None,
    descending: bool = False,
    limit: int = 20,
) -> TestsResult:
    s = study(cur, slug)
    cols = repo.columns(cur, slug, "tests")
    wanted = columns or [c for c in DEFAULT_COLUMNS.get(slug, []) if c in cols] or list(cols)
    unknown = [c for c in [*wanted, sort or s.test_key] if c not in cols]
    if unknown:
        raise InvalidQuery(f"unknown column(s) {', '.join(unknown)}; columns: {', '.join(cols)}")
    for f in filters:  # колонки з умов теж показуємо — на них спирається відповідь
        if f.field in cols and f.field not in wanted:
            wanted.append(f.field)
    select = [s.test_key, *[c for c in wanted if c != s.test_key]]
    cond, params = repo.where(cols, filters)
    total, rows = repo.query_tests(
        cur, slug, select, cond, params, sort or s.test_key, descending, max(1, min(limit, 50))
    )
    url = study_tests_url(slug, _tests_query(filters))
    summary = Source(
        url=url,
        title=f"{s.acronym} test query result",
        text=(
            f"{total} {s.acronym} tests match "
            + (
                "; ".join(f"{f.field} {f.op} {f.value or ''}".strip() for f in filters)
                or "no filter"
            )
            + f"; showing {len(rows)}."
        ),
    )
    return TestsResult(
        total=total,
        tests=rows,
        sources=[summary, *(_row_source(s, r, select) for r in rows)],
    )


def aggregate(
    cur: duckdb.DuckDBPyConnection,
    slug: str,
    filters: list[Filter],
    group_by: str | None = None,
    metric: str | None = None,
) -> AggregateResult:
    s = study(cur, slug)
    cols = repo.columns(cur, slug, "tests")
    for c in (group_by, metric):
        if c and c not in cols:
            raise InvalidQuery(f"unknown column {c!r}; columns: {', '.join(cols)}")
    if metric and not repo.is_numeric(cols[metric]):
        raise InvalidQuery(f"{metric} is not numeric; mean/min/max need a numeric column")
    cond, params = repo.where(cols, filters)
    groups = repo.aggregate(cur, slug, cond, params, group_by, metric)
    where_txt = (
        "; ".join(f"{f.field} {f.op} {f.value or ''}".strip() for f in filters) or "all tests"
    )
    lines = []
    for g in groups:
        head = f"{group_by} = {fmt(g.get('grp'))}: " if group_by else ""
        line = f"{head}{g['n_tests']} tests"
        if metric:
            line += (
                f"; {metric} recorded for {g['n_values']}, mean {fmt(g['mean'])}, "
                f"min {fmt(g['min'])}, max {fmt(g['max'])}"
            )
        lines.append(line)
    q = _tests_query(filters)
    extra = "&".join(x for x in (f"group_by={group_by}" if group_by else "",
                                  f"metric={metric}" if metric else "") if x)  # fmt: skip
    src = Source(
        url=f"{study_url(slug)}/aggregate?" + "&".join(x for x in (q, extra) if x),
        title=f"{s.acronym} test table: computed counts"
        + (f" and statistics of {metric}" if metric else ""),
        text=(
            f"Computed from the {s.acronym} test table ({where_txt})"
            + (f", grouped by {group_by}" if group_by else "")
            + ":\n"
            + "\n".join(lines)
        ),
    )
    return AggregateResult(groups=groups, sources=[src])


def _test(cur: duckdb.DuckDBPyConnection, s: Study, test_id: str) -> dict[str, Any]:
    cols = repo.columns(cur, s.slug, "tests")
    row = repo.get_test(cur, s.slug, s.test_key, cols[s.test_key], str(test_id).strip())
    if row is None:
        raise NotFound(f"{test_name(s, test_id)} not found")
    return row


def _series_key_value(s: Study, row: dict[str, Any]) -> Any:
    return row.get(s.series_key)


def get_test(cur: duckdb.DuckDBPyConnection, slug: str, test_id: str) -> TestDetail:
    s = study(cur, slug)
    row = _test(cur, s, test_id)
    tid = row[s.test_key]
    cols = repo.columns(cur, slug, "tests")
    files = repo.test_files(cur, slug, s.test_key, cols[s.test_key], str(tid))
    key_value = _series_key_value(s, row)
    series = {}
    for t in repo.tables(cur, slug):
        if t.startswith("ts_") and key_value is not None:
            n = repo.series_rows(cur, slug, t, s.series_key, key_value)
            if n:
                series[t[3:]] = n
    recorded = "; ".join(f"{c} = {fmt(v)}" for c, v in row.items() if v is not None)
    missing = [c for c, v in row.items() if v is None]
    text = f"{test_name(s, tid)}: {recorded}."
    if missing:
        text += f" Not recorded: {', '.join(missing)}."
    series_txt = ", ".join(f"{k} ({n} points)" for k, n in series.items()) or "none"
    kinds: dict[str, int] = {}
    for f in files:
        kinds[f["kind"] or "other"] = kinds.get(f["kind"] or "other", 0) + 1
    files_txt = ", ".join(f"{k} ({n})" for k, n in kinds.items()) or "none"
    src = Source(
        url=study_test_url(slug, tid), title=f"{test_name(s, tid)} (test table)", text=text
    )
    extra = Source(
        url=study_test_url(slug, tid),
        title=f"{test_name(s, tid)}: available data",
        text=(
            f"{test_name(s, tid)} time series in this dataset: {series_txt}. "
            f"Files listed in NASA PSI for this test, by kind: {files_txt}."
        ),
    )
    return TestDetail(test=row, series=series, files=files, sources=[src, extra])


def timeseries(
    cur: duckdb.DuckDBPyConnection, slug: str, test_id: str, series: str, max_points: int = 500
) -> SeriesResult:
    s = study(cur, slug)
    table = f"ts_{series}"
    tables = repo.tables(cur, slug)
    if table not in tables:
        names = ", ".join(t[3:] for t in tables if t.startswith("ts_")) or "none"
        raise NotFound(f"{s.acronym} has no series {series!r}; series: {names}")
    row = _test(cur, s, test_id)
    tid, key_value = row[s.test_key], _series_key_value(s, row)
    cols = repo.columns(cur, slug, table)
    if s.series_key not in cols or key_value is None:
        raise NotFound(f"{test_name(s, tid)} has no {series} series")
    n = repo.series_rows(cur, slug, table, s.series_key, key_value)
    if not n:
        raise NotFound(f"{test_name(s, tid)} has no {series} series")
    numeric = _series_columns(cur, s, table)
    stats = repo.series_stats(cur, slug, table, s.series_key, key_value, numeric)
    order = next((c for c in TIME_COLUMNS if c in cols), numeric[0] if numeric else s.series_key)
    points = repo.series_points(
        cur, slug, table, s.series_key, key_value, order, max(2, min(max_points, 5000))
    )
    per_run = (
        f" (run {key_value}, shared by all tests of this run)" if s.series_key != s.test_key else ""
    )
    lines = [
        f"- {st['column']}: {st['n']} values, min {fmt(st['min'])}, max {fmt(st['max'])}"
        for st in stats
        if st["n"]
    ]
    empty = [st["column"] for st in stats if not st["n"]]
    text = f"{s.acronym} {series} series of {test_name(s, tid)}{per_run}: {n} rows.\n" + "\n".join(
        lines
    )
    if empty:
        text += f"\nNo values: {', '.join(empty)}."
    src = Source(
        url=study_series_url(slug, tid, series),
        title=f"{test_name(s, tid)} {series} series summary",
        text=text,
    )
    return SeriesResult(series=series, n_points=n, stats=stats, points=points, sources=[src])
