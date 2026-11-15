"""Інструменти даних агента: тонкі обгортки над сервісами `studies.flex` і `rag`.

Кожен інструмент повертає `ToolOutput`: вміст `tool_result` для Claude API (блоки
`search_result` з цитатами — ADR 0006, плюс службовий текст без чисел, які треба цитувати)
і рядок статусу для UI. SQL тут немає — лише виклики сервісів.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

import duckdb

from flame.core.citations import (
    API_PREFIX,
    STUDY_SLUGS,
    Source,
    compare_url,
    neighbors_url,
    test_url,
    to_search_result,
)
from flame.rag import service as rag_service
from flame.rag.schemas import SearchFilters
from flame.studies.flex import charts
from flame.studies.flex import repository as flex_repository
from flame.studies.flex import service as flex
from flame.studies.flex.fields import FIELDS, SIGNALS
from flame.studies.flex.schemas import Filter

STUDY = "PSI-69"
OPS = ["eq", "ne", "lt", "lte", "gt", "gte", "in", "is_null", "not_null"]
DOC_TYPES = ["testsheet", "doc_pdf", "doc_docx", "about", "publication"]


class ToolError(Exception):
    """Помилка вводу інструмента: повертається моделі як `is_error`, щоб вона виправилась."""


@dataclass
class ToolOutput:
    sources: list[Source] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)  # підсумок виклику («8 tests match…»)
    note_url: str = ""  # джерело підсумку; API не дозволяє змішувати text і search_result
    events: list[dict[str, Any]] = field(default_factory=list)  # SSE для UI (proposal…)

    def content(self) -> list[dict[str, Any]]:
        if not self.sources:
            return [{"type": "text", "text": " ".join(self.notes) or "No results."}]
        blocks = [to_search_result(s) for s in self.sources]
        if self.notes:
            note = Source(url=self.note_url, title="Result summary", text=" ".join(self.notes))
            blocks.insert(0, to_search_result(note))
        return blocks


def _fields_catalog() -> str:
    lines = []
    for f in FIELDS.values():
        extra = f" [{f.unit}]" if f.unit else ""
        if f.values:
            extra += f" one of {', '.join(f.values)}"
        lines.append(f"- {f.name} ({f.type}{extra}): {f.description}")
    return "\n".join(lines)


def _obj(props: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": props,
        "required": list(props),
        "additionalProperties": False,
    }


TEST_NO = {"type": "integer", "description": "FLEX test number, e.g. 19 for FLEX-019"}

TOOLS: list[dict[str, Any]] = [
    {
        "name": "query_tests",
        "description": (
            "Find FLEX tests by experiment conditions from the NASA test table. Use it for any "
            "question about which tests exist, counts, ranges, or conditions. Every returned test "
            "is a citable source. Filter fields:\n" + _fields_catalog() + "\n"
            "Ops: eq, ne, lt, lte, gt, gte (numbers/dates), in (value = comma-separated list), "
            "is_null / not_null (value = empty string). Text and bool fields accept eq, ne, in."
        ),
        "input_schema": _obj(
            {
                "filters": {
                    "type": "array",
                    "items": _obj(
                        {
                            "field": {"type": "string", "enum": list(FIELDS)},
                            "op": {"type": "string", "enum": OPS},
                            "value": {"type": "string"},
                        }
                    ),
                },
                "sort": {"type": "string", "enum": list(FIELDS)},
                "descending": {"type": "boolean"},
                "limit": {"type": "integer", "description": "1-50"},
            }
        ),
    },
    {
        "name": "get_test",
        "description": (
            "All recorded parameters of one FLEX test and the researcher's TestSheet comment "
            "(what happened during the burn). Conditions come from the table; the comment only "
            "describes behaviour."
        ),
        "input_schema": _obj({"test_no": TEST_NO}),
    },
    {
        "name": "compare_tests",
        "description": (
            "Deterministic parameter comparison of 2-8 tests: values side by side, differences "
            "relative to the first test, and warnings (fiber vs free droplet, different fuels, "
            "Disruption, missing values, data conflicts)."
        ),
        "input_schema": _obj(
            {"test_nos": {"type": "array", "items": TEST_NO, "description": "2-8 tests"}}
        ),
    },
    {
        "name": "find_similar_tests",
        "description": (
            "Tests with the most similar conditions (same fuel and droplet type). Similarity is an "
            "estimate; say so when you use it."
        ),
        "input_schema": _obj({"test_no": TEST_NO, "k": {"type": "integer", "description": "1-10"}}),
    },
    {
        "name": "get_timeseries_summary",
        "description": (
            "Summary of a measured time series of one test: number of samples and the range of "
            "each quantity. Signals: droplet (droplet diameter and position), flame_color and "
            "flame_uv (flame diameter and standoff), chamber (pressure and temperatures)."
        ),
        "input_schema": _obj(
            {"test_no": TEST_NO, "signal": {"type": "string", "enum": list(SIGNALS)}}
        ),
    },
    {
        "name": "search_docs",
        "description": (
            "Search FLEX texts: researcher TestSheet comments, NASA engineering and science "
            "documents, presentations, the investigation description and publication list. Use "
            "it for why/how questions, procedures, definitions and what happened in a test. "
            "Write the query in English. Optionally restrict to tests or source types."
        ),
        "input_schema": _obj(
            {
                "query": {"type": "string"},
                "test_nos": {"type": "array", "items": TEST_NO},
                "source_types": {"type": "array", "items": {"type": "string", "enum": DOC_TYPES}},
            }
        ),
    },
]


# Фасети Дослідника (frontend/src/features/explorer/lib/filter.ts) — ті самі ключі й значення,
# щоб пропозиція «open_tests» відкрила Explorer з тими самими фільтрами.
EXPLORER_FACETS: dict[str, list[str]] = {
    "fuel": ["Heptane", "Methanol"],
    "diluent": ["N2", "CO2", "He"],
    "pressure": ["0.7", "1", "2-3"],
    "o2": ["<16.5", "16.5-21", "air", "21.6-30", "30+"],
    "fiber": ["free", "fiber", "unknown", "all"],
    "end": ["Extinction", "Disruption", "Completion"],
    "tag": ["series", "video", "3d", "cool"],
}
ACTIONS = ["open_tests", "open_test", "open_compare"]

UI_TOOLS: list[dict[str, Any]] = [
    {
        "name": "propose_action",
        "description": (
            "Show the user a button that opens a page of the website. Nothing happens until the "
            "user clicks it. Use it when the user wants to see, open, browse or compare tests. "
            "open_test: one test in test_nos. open_compare: 2-3 tests in test_nos (the compare "
            "page holds at most 3). open_tests: the test explorer filtered by the explorer facets "
            "(empty arrays mean no filter; pressure bands 0.7 / 1 / 2-3 atm; o2 bands <16.5, "
            "16.5-21, air (21%), 21.6-30, 30+ percent; fiber defaults to free-floating, use all to "
            "include fiber tests). label is the button text, e.g. 'Compare FLEX-019 and FLEX-027'."
        ),
        "input_schema": _obj(
            {
                "action": {"type": "string", "enum": ACTIONS},
                "label": {"type": "string"},
                "test_nos": {"type": "array", "items": TEST_NO},
                "explorer": _obj(
                    {
                        k: {"type": "array", "items": {"type": "string", "enum": v}}
                        for k, v in EXPLORER_FACETS.items()
                    }
                ),
            }
        ),
    },
    {
        "name": "highlight_params",
        "description": (
            "Highlight parameters on the page the user is looking at (test page or comparison), "
            "e.g. the values your answer talks about. It happens immediately and changes nothing "
            "else. Use field names from query_tests."
        ),
        "input_schema": _obj(
            {
                "fields": {"type": "array", "items": {"type": "string", "enum": list(FIELDS)}},
                "test_nos": {"type": "array", "items": TEST_NO},
            }
        ),
    },
]
CHART_TOOL: dict[str, Any] = {
    "name": "make_chart",
    "description": (
        "Draw a chart in the chat from the FLEX data. kind=line: one quantity over time for 1-3 "
        "tests (shared axes) - quantity is one of "
        + ", ".join(charts.QUANTITIES)
        + " (droplet_d2 and droplet_d2_normalized are derived from the measured diameter; the "
        "slope of d² over time is the burning-rate constant). kind=scatter: two numeric "
        "fields of the test table across the tests matching filters (same filter format as "
        "query_tests), dots grouped by how the test ended. For line charts leave filters, "
        "x_field and y_field empty; for scatter leave quantity and test_nos empty. The user "
        "sees the chart; describe what it shows using the returned summaries."
    ),
    "input_schema": _obj(
        {
            "kind": {"type": "string", "enum": ["line", "scatter"]},
            "quantity": {"type": "string", "enum": ["", *charts.QUANTITIES]},
            "test_nos": {"type": "array", "items": TEST_NO},
            "filters": TOOLS[0]["input_schema"]["properties"]["filters"],
            "x_field": {"type": "string", "enum": ["", *charts.NUMERIC_FIELDS]},
            "y_field": {"type": "string", "enum": ["", *charts.NUMERIC_FIELDS]},
        }
    ),
}

TOOLS.extend(UI_TOOLS)
TOOLS.append(CHART_TOOL)


def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(int(v), hi))


def _tests_url(filters: list[Filter]) -> str:
    """URL запиту тестів з тими самими фільтрами (`/api/studies/flex/tests?f=…`)."""
    parts = [
        f"{f.field}:{f.op}" + (f":{f.value}" if f.value not in (None, "") else "") for f in filters
    ]
    qs = "&".join(f"f={quote(p, safe=':,')}" for p in parts)
    base = f"{API_PREFIX}/studies/{STUDY_SLUGS[STUDY]}/tests"
    return f"{base}?{qs}" if qs else base


def query_tests(cur: duckdb.DuckDBPyConnection, args: dict[str, Any]) -> ToolOutput:
    filters = [Filter(**f) for f in args.get("filters") or []]
    for f in filters:
        if f.op in ("is_null", "not_null"):
            f.value = None
    try:
        res = flex.query_tests(
            cur,
            filters,
            args.get("sort") or "test_no",
            bool(args.get("descending")),
            _clamp(args.get("limit") or 20, 1, 50),
        )
    except flex_repository.InvalidFilter as e:
        raise ToolError(str(e)) from e
    if not res.tests:  # «немає таких тестів» — теж факт, який треба цитувати
        empty = Source(
            url=_tests_url(filters),
            title="Result summary",
            text="No FLEX tests match these filters: "
            + ("; ".join(f"{f.field} {f.op} {f.value or ''}".strip() for f in filters) or "none")
            + ".",
        )
        return ToolOutput(sources=[empty])
    shown = len(res.tests)
    note = f"{res.total} tests match; showing {shown}."
    if shown < res.total:
        note += " Narrow the filters or raise the limit to see the rest."
    return ToolOutput(sources=res.sources, notes=[note], note_url=_tests_url(filters))


def get_test(cur: duckdb.DuckDBPyConnection, args: dict[str, Any]) -> ToolOutput:
    try:
        d = flex.get_test(cur, int(args["test_no"]))
    except flex.NotFound as e:
        raise ToolError(str(e)) from e
    files = ", ".join(f.name for f in d.files) or "none"
    return ToolOutput(
        sources=d.sources,
        notes=[f"Local files for this test: {files}."],
        note_url=test_url(STUDY, int(args["test_no"])),
    )


def _compare_source(cmp: Any) -> Source:
    lines = []
    for f in cmp.fields:
        vals = "; ".join(
            f"{flex.test_name(int(n))}: {v if v is not None else 'not recorded'}"
            for n, v in f.values.items()
        )
        unit = f" [{f.unit}]" if f.unit else ""
        line = f"{FIELDS[f.field].description}{unit}: {vals}"
        if f.diff_vs_first:
            diffs = ", ".join(
                f"{flex.test_name(int(n))} {d:+g}" for n, d in f.diff_vs_first.items()
            )
            line += f" (difference vs {flex.test_name(cmp.test_nos[0])}: {diffs})"
        lines.append(line)
    if cmp.warnings:
        lines.append("Warnings: " + " ".join(cmp.warnings))
    names = ", ".join(flex.test_name(n) for n in cmp.test_nos)
    return Source(
        url=compare_url(STUDY, cmp.test_nos),
        title=f"Computed comparison of {names} (from the FLEX table)",
        text="\n".join(lines),
    )


def compare_tests(cur: duckdb.DuckDBPyConnection, args: dict[str, Any]) -> ToolOutput:
    nos = [int(n) for n in args.get("test_nos") or []][:8]
    try:
        cmp = flex.compare_tests(cur, nos)
    except (flex.NotFound, ValueError) as e:
        raise ToolError(str(e)) from e
    return ToolOutput(sources=[_compare_source(cmp), *cmp.sources])


def find_similar_tests(cur: duckdb.DuckDBPyConnection, args: dict[str, Any]) -> ToolOutput:
    n = int(args["test_no"])
    try:
        res = flex.neighbors(cur, n, _clamp(args.get("k") or 5, 1, 10))
    except flex.NotFound as e:
        raise ToolError(str(e)) from e
    ranking = "; ".join(
        f"{flex.test_name(x.test.test_no)} distance {x.distance}" for x in res.neighbors
    )
    summary = Source(
        url=neighbors_url(STUDY, n),
        title=f"Tests most similar to {flex.test_name(n)} (estimate)",
        text=f"{res.note} Ranking: {ranking or 'no comparable tests'}.",
    )
    return ToolOutput(sources=[summary, *res.sources])


def get_timeseries_summary(cur: duckdb.DuckDBPyConnection, args: dict[str, Any]) -> ToolOutput:
    try:
        ts = flex.get_timeseries(cur, int(args["test_no"]), str(args["signal"]), max_points=10)
    except flex.NotFound as e:
        raise ToolError(str(e)) from e
    return ToolOutput(sources=ts.sources)


def search_docs(cur: duckdb.DuckDBPyConnection, args: dict[str, Any]) -> ToolOutput:
    query = str(args.get("query") or "").strip()
    if len(query) < 2:
        raise ToolError("query is empty")
    filters = SearchFilters(
        study=STUDY,
        test_nos=[int(n) for n in args.get("test_nos") or []] or None,
        source_types=list(args.get("source_types") or []) or None,
    )
    hits = rag_service.search(cur, query, 6, filters)
    if not hits:
        return ToolOutput(notes=["No matching passages in the FLEX texts."])
    return ToolOutput(sources=[h.to_source() for h in hits])


def _existing(cur: duckdb.DuckDBPyConnection, nos: list[int]) -> list[int]:
    found = {r["test_no"] for r in flex_repository.get_tests(cur, nos)}
    missing = [n for n in nos if n not in found]
    if missing:
        raise ToolError(f"no such tests: {', '.join(flex.test_name(n) for n in missing)}")
    return nos


def propose_action(cur: duckdb.DuckDBPyConnection, args: dict[str, Any]) -> ToolOutput:
    action = args.get("action")
    nos = list(dict.fromkeys(int(n) for n in args.get("test_nos") or []))
    params: dict[str, Any] = {}
    if action == "open_test":
        if len(nos) != 1:
            raise ToolError("open_test needs exactly one test in test_nos")
        params["test_nos"] = _existing(cur, nos)
    elif action == "open_compare":
        if not 2 <= len(nos) <= 3:
            raise ToolError("open_compare needs 2 or 3 tests (the compare page holds at most 3)")
        params["test_nos"] = _existing(cur, nos)
    elif action == "open_tests":
        explorer = args.get("explorer") or {}
        clean = {}
        for key, allowed in EXPLORER_FACETS.items():
            vals = [v for v in explorer.get(key) or [] if v in allowed]
            if vals:
                clean[key] = vals
        params["explorer"] = clean
    else:
        raise ToolError(f"unknown action {action!r}")
    label = str(args.get("label") or "").strip()[:80] or "Open"
    event = {"event": "proposal", "data": {"action": action, "label": label, "params": params}}
    return ToolOutput(
        notes=["Shown to the user as a button; nothing opens until they click it."],
        events=[event],
    )


def highlight_params(cur: duckdb.DuckDBPyConnection, args: dict[str, Any]) -> ToolOutput:
    fields = [f for f in args.get("fields") or [] if f in FIELDS]
    if not fields:
        raise ToolError("no known fields to highlight")
    nos = [int(n) for n in args.get("test_nos") or []]
    event = {"event": "highlight", "data": {"fields": fields, "test_nos": nos}}
    return ToolOutput(
        notes=["Highlighted on the page where these values are visible."], events=[event]
    )


def make_chart(cur: duckdb.DuckDBPyConnection, args: dict[str, Any]) -> ToolOutput:
    try:
        if args.get("kind") == "scatter":
            filters = [Filter(**f) for f in args.get("filters") or []]
            for f in filters:
                if f.op in ("is_null", "not_null"):
                    f.value = None
            out = charts.scatter(cur, filters, args.get("x_field", ""), args.get("y_field", ""))
        else:
            nos = [int(n) for n in args.get("test_nos") or []]
            out = charts.line(cur, args.get("quantity", ""), nos)
    except charts.ChartError as e:
        raise ToolError(str(e)) from e
    notes = out["chart"]["notes"]
    return ToolOutput(
        sources=out["sources"],
        notes=[f"Chart shown to the user. {'; '.join(notes)}"] if notes else [],
        note_url=out["sources"][0].url,
        events=[{"event": "chart", "data": out["chart"]}],
    )


Handler = Callable[[duckdb.DuckDBPyConnection, dict[str, Any]], ToolOutput]

HANDLERS: dict[str, Handler] = {
    "query_tests": query_tests,
    "get_test": get_test,
    "compare_tests": compare_tests,
    "find_similar_tests": find_similar_tests,
    "get_timeseries_summary": get_timeseries_summary,
    "search_docs": search_docs,
    "propose_action": propose_action,
    "highlight_params": highlight_params,
    "make_chart": make_chart,
}


def status_text(name: str, args: dict[str, Any]) -> str:
    """Короткий опис кроку для UI («Searching tests…»)."""
    n = args.get("test_no")
    match name:
        case "query_tests":
            return "Searching the test table…"
        case "get_test":
            return f"Reading {flex.test_name(int(n))}…" if n else "Reading a test…"
        case "compare_tests":
            nos = ", ".join(flex.test_name(int(x)) for x in args.get("test_nos") or [])
            return f"Comparing {nos}…"
        case "find_similar_tests":
            return "Finding tests with similar conditions…"
        case "get_timeseries_summary":
            return f"Reading {args.get('signal')} data…"
        case "search_docs":
            return f"Searching documents: “{args.get('query', '')}”…"
        case "propose_action":
            return "Preparing a link…"
        case "highlight_params":
            return "Highlighting values on the page…"
        case "make_chart":
            return "Drawing a chart from the data…"
    return "Working…"
