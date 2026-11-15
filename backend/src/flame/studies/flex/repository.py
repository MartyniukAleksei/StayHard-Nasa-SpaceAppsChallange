"""SQL до таблиць FLEX. Лише параметризовані запити; ідентифікатори — тільки з fields.py."""

from typing import Any

import duckdb

from flame.studies.flex.fields import FIBER_CONFLICT_SQL, FIELDS, SIGNALS, SUMMARY_COLUMNS
from flame.studies.flex.schemas import Filter

_SQL_OPS = {"eq": "=", "ne": "<>", "lt": "<", "lte": "<=", "gt": ">", "gte": ">="}


class InvalidFilter(ValueError):
    pass


def _rows(cur: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    names = [d[0] for d in cur.description]
    return [dict(zip(names, r, strict=True)) for r in cur.fetchall()]


def _coerce(field: str, value: Any) -> Any:
    info = FIELDS[field]
    try:
        if info.type == "number":
            return float(value)
        if info.type == "bool":
            if isinstance(value, str):
                if value.lower() not in ("true", "false", "1", "0", "yes", "no"):
                    raise ValueError(value)
                return value.lower() in ("true", "1", "yes")
            return bool(value)
        text = str(value)
    except (TypeError, ValueError) as e:
        raise InvalidFilter(f"{field}: expected {info.type}, got {value!r}") from e
    if info.values:  # enum — нечутливо до регістру, повертаємо канонічне написання
        canon = {v.lower(): v for v in info.values}
        if text.lower() not in canon:
            raise InvalidFilter(f"{field}: expected one of {info.values}, got {value!r}")
        return canon[text.lower()]
    return text


def where_clause(filters: list[Filter]) -> tuple[str, list[Any]]:
    clauses, params = ["TRUE"], []
    for f in filters:
        if f.field not in FIELDS:
            raise InvalidFilter(f"unknown field {f.field!r}; see /api/studies/flex/fields")
        col = f.field  # безпечно: ключ whitelist-у
        if f.op == "is_null":
            clauses.append(f"{col} IS NULL")
        elif f.op == "not_null":
            clauses.append(f"{col} IS NOT NULL")
        elif f.op == "in":
            values = f.value if isinstance(f.value, list) else str(f.value).split(",")
            clauses.append(f"list_contains(?, {col})")
            params.append([_coerce(f.field, v) for v in values])
        else:
            if FIELDS[f.field].type in ("text", "bool") and f.op not in ("eq", "ne"):
                raise InvalidFilter(f"{f.field}: op {f.op} needs a number or date field")
            clauses.append(f"{col} {_SQL_OPS[f.op]} ?")
            params.append(_coerce(f.field, f.value))
    return " AND ".join(clauses), params


def count_tests(cur: duckdb.DuckDBPyConnection, filters: list[Filter]) -> int:
    where, params = where_clause(filters)
    return cur.execute(f"SELECT count(*) FROM tests WHERE {where}", params).fetchone()[0]


def query_tests(
    cur: duckdb.DuckDBPyConnection,
    filters: list[Filter],
    sort: str = "test_no",
    descending: bool = False,
    limit: int = 50,
) -> list[dict[str, Any]]:
    if sort not in FIELDS:
        raise InvalidFilter(f"unknown sort field {sort!r}")
    where, params = where_clause(filters)
    order = "DESC" if descending else "ASC"
    cur.execute(
        f"""
        SELECT {", ".join(SUMMARY_COLUMNS)}, {FIBER_CONFLICT_SQL} AS fiber_conflict
        FROM tests WHERE {where}
        ORDER BY {sort} {order} NULLS LAST, test_no LIMIT ?
        """,
        [*params, limit],
    )
    return _rows(cur)


def get_tests(cur: duckdb.DuckDBPyConnection, test_nos: list[int]) -> list[dict[str, Any]]:
    cur.execute(
        f"SELECT *, {FIBER_CONFLICT_SQL} AS fiber_conflict FROM tests "
        "WHERE list_contains(?, test_no) ORDER BY test_no",
        [test_nos],
    )
    return _rows(cur)


def all_tests(cur: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    cur.execute(
        f"SELECT {', '.join(SUMMARY_COLUMNS)}, {FIBER_CONFLICT_SQL} AS fiber_conflict "
        "FROM tests ORDER BY test_no"
    )
    return _rows(cur)


def timeseries(
    cur: duckdb.DuckDBPyConnection, test_no: int, signal: str
) -> tuple[list[str], list[tuple]]:
    table, cols, _ = SIGNALS[signal]  # signal перевірено в service
    order = "timestamp" if signal == "chamber" else "t_s"
    cur.execute(
        f"SELECT {', '.join(cols)} FROM {table} WHERE test_no = ? ORDER BY {order}", [test_no]
    )
    return cols, cur.fetchall()
