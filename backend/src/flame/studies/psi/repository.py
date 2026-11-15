"""SQL до таблиць інших досліджень PSI (схеми `cfi`, `cfig`, `bass2`, `samer`, `saffire2`).

Ідентифікатори (схема, таблиця, колонка) у SQL потрапляють лише після перевірки за реєстром
`flame.core.studies` і `information_schema` цієї ж БД; значення — лише параметрами.
"""

from typing import Any

import duckdb

from flame.core.studies import PSI_STUDIES
from flame.studies.psi.schemas import Filter

_CMP = {"eq": "=", "ne": "<>", "lt": "<", "lte": "<=", "gt": ">", "gte": ">="}
_NUMERIC = ("TINYINT", "SMALLINT", "INTEGER", "BIGINT", "HUGEINT", "FLOAT", "DOUBLE", "DECIMAL")
_ORDERED = (*_NUMERIC, "DATE", "TIMESTAMP", "TIME")
_TRUE, _FALSE = {"true", "1", "yes", "y", "t"}, {"false", "0", "no", "n", "f"}


class InvalidQuery(ValueError):
    """Невідоме дослідження/таблиця/колонка або значення не того типу."""


def is_numeric(sql_type: str) -> bool:
    return sql_type.upper().startswith(_NUMERIC)


def _rows(cur: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    names = [d[0] for d in cur.description]
    return [dict(zip(names, r, strict=True)) for r in cur.fetchall()]


def _q(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def loaded(cur: duckdb.DuckDBPyConnection, slug: str) -> bool:
    """Чи є знімок дослідження в цій збірці БД (схема з таблицею tests)."""
    if slug not in PSI_STUDIES:
        return False
    cur.execute(
        "SELECT count(*) FROM information_schema.tables"
        " WHERE table_schema = ? AND table_name = 'tests'",
        [slug],
    )
    return cur.fetchone()[0] > 0


def registry(cur: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    """Таблиця `studies` (усі дослідження цієї збірки, включно з FLEX)."""
    cur.execute("SELECT * FROM studies ORDER BY rowid")
    return _rows(cur)


def tables(cur: duckdb.DuckDBPyConnection, slug: str) -> dict[str, int]:
    """Таблиці схеми дослідження → кількість рядків."""
    cur.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY 1", [slug]
    )
    names = [r[0] for r in cur.fetchall()]
    out = {}
    for t in names:
        cur.execute(f"SELECT count(*) FROM {_q(slug)}.{_q(t)}")
        out[t] = cur.fetchone()[0]
    return out


def columns(cur: duckdb.DuckDBPyConnection, slug: str, table: str) -> dict[str, str]:
    """Колонки таблиці → тип SQL (у порядку таблиці); {} якщо таблиці немає."""
    if slug not in PSI_STUDIES:
        return {}
    cur.execute(
        "SELECT column_name, data_type FROM information_schema.columns"
        " WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
        [slug, table],
    )
    return dict(cur.fetchall())


def column_profile(
    cur: duckdb.DuckDBPyConnection, slug: str, cols: dict[str, str], max_values: int = 12
) -> list[dict[str, Any]]:
    """Профіль колонок `tests`: заповненість, діапазон чисел/дат, значення коротких текстів."""
    out = []
    for name, sql_type in cols.items():
        col = _q(name)
        info: dict[str, Any] = {"column": name, "type": sql_type}
        cur.execute(f"SELECT count({col}), count(DISTINCT {col}) FROM {_q(slug)}.tests")
        info["non_null"], n_distinct = cur.fetchone()
        if sql_type.upper().startswith(_ORDERED):
            cur.execute(f"SELECT min({col}), max({col}) FROM {_q(slug)}.tests")
            info["min"], info["max"] = cur.fetchone()
        elif n_distinct and n_distinct <= max_values:
            cur.execute(
                f"SELECT {col}, count(*) FROM {_q(slug)}.tests WHERE {col} IS NOT NULL"
                f" GROUP BY 1 ORDER BY 2 DESC, 1"
            )
            info["values"] = {str(v): n for v, n in cur.fetchall()}
        else:
            info["distinct"] = n_distinct
        out.append(info)
    return out


def _bool(field: str, value: Any) -> bool:
    text = str(value).strip().lower()
    if text in _TRUE:
        return True
    if text in _FALSE:
        return False
    raise InvalidQuery(f"{field}: expected true or false, got {value!r}")


def where(cols: dict[str, str], filters: list[Filter]) -> tuple[str, list[Any]]:
    """Фільтри → (SQL-умова, параметри). Числа й дати порівнюються як свої типи, текст —
    без урахування регістру; `contains` — підрядок у тексті."""
    clauses: list[str] = []
    params: list[Any] = []
    for f in filters:
        if f.field not in cols:
            raise InvalidQuery(f"unknown column {f.field!r}; columns: {', '.join(cols)}")
        col, sql_type = _q(f.field), cols[f.field]
        upper = sql_type.upper()
        text = upper.startswith("VARCHAR")
        if f.op == "is_null":
            clauses.append(f"{col} IS NULL")
            continue
        if f.op == "not_null":
            clauses.append(f"{col} IS NOT NULL")
            continue
        if f.value is None or str(f.value).strip() == "":
            raise InvalidQuery(f"{f.field} {f.op}: value is empty")
        raw = str(f.value)
        if f.op == "contains":
            if not text:
                raise InvalidQuery(f"contains works only on text columns; {f.field} is {sql_type}")
            clauses.append(f"{col} ILIKE '%' || ? || '%'")
            params.append(raw)
            continue
        values = [v.strip() for v in raw.split(",")] if f.op == "in" else [raw.strip()]
        if upper == "BOOLEAN":
            if f.op not in ("eq", "ne", "in"):
                raise InvalidQuery(f"{f.field} is true/false: use eq, ne or in")
            params.extend(_bool(f.field, v) for v in values)
            marks = ", ".join("?" * len(values))
            clauses.append(f"{col} IN ({marks})" if f.op == "in" else f"{col} {_CMP[f.op]} ?")
            continue
        if text:
            if f.op not in ("eq", "ne", "in"):
                raise InvalidQuery(f"{f.field} is text: use eq, ne, in or contains")
            params.extend(v.lower() for v in values)
            marks = ", ".join("?" * len(values))
            clauses.append(
                f"lower({col}) IN ({marks})" if f.op == "in" else f"lower({col}) {_CMP[f.op]} ?"
            )
            continue
        if not upper.startswith(_ORDERED):
            raise InvalidQuery(f"{f.field} ({sql_type}) cannot be filtered")
        try:  # проба типу на боці Python, щоб помилка була зрозумілою моделі
            if is_numeric(sql_type):
                [float(v) for v in values]
        except ValueError as e:
            raise InvalidQuery(f"{f.field}: expected a number, got {raw!r}") from e
        cast = f"CAST(? AS {sql_type})"
        params.extend(values)
        if f.op == "in":
            clauses.append(f"{col} IN ({', '.join([cast] * len(values))})")
        else:
            clauses.append(f"{col} {_CMP[f.op]} {cast}")
    return (" AND ".join(clauses) or "TRUE"), params


def query_tests(
    cur: duckdb.DuckDBPyConnection,
    slug: str,
    select: list[str],
    cond: str,
    params: list[Any],
    sort: str,
    descending: bool,
    limit: int,
) -> tuple[int, list[dict[str, Any]]]:
    """(скільки тестів підходить, перші `limit` рядків з колонками `select`)."""
    table = f"{_q(slug)}.tests"
    try:
        cur.execute(f"SELECT count(*) FROM {table} WHERE {cond}", params)
        (total,) = cur.fetchone()
        order = f"{_q(sort)} {'DESC' if descending else 'ASC'} NULLS LAST"
        cur.execute(
            f"SELECT {', '.join(_q(c) for c in select)} FROM {table} WHERE {cond}"
            f" ORDER BY {order} LIMIT ?",
            [*params, limit],
        )
    except duckdb.ConversionException as e:
        raise InvalidQuery(f"value has the wrong type: {e}") from e
    return total, _rows(cur)


def aggregate(
    cur: duckdb.DuckDBPyConnection,
    slug: str,
    cond: str,
    params: list[Any],
    group_by: str | None,
    metric: str | None,
) -> list[dict[str, Any]]:
    """Кількість тестів (і count/avg/min/max числової колонки) по групах або загалом."""
    parts = ["count(*) AS n_tests"]
    if metric:
        m = _q(metric)
        parts += [f"count({m}) AS n_values", f"avg({m}) AS mean", f"min({m}) AS min",
                  f"max({m}) AS max"]  # fmt: skip
    table = f"{_q(slug)}.tests"
    try:
        if group_by:
            g = _q(group_by)
            cur.execute(
                f"SELECT {g} AS grp, {', '.join(parts)} FROM {table} WHERE {cond}"
                f" GROUP BY {g} ORDER BY n_tests DESC, grp NULLS LAST LIMIT 50",
                params,
            )
        else:
            cur.execute(f"SELECT {', '.join(parts)} FROM {table} WHERE {cond}", params)
    except duckdb.ConversionException as e:
        raise InvalidQuery(f"value has the wrong type: {e}") from e
    return _rows(cur)


def get_test(
    cur: duckdb.DuckDBPyConnection, slug: str, key: str, key_type: str, test_id: str
) -> dict[str, Any] | None:
    try:
        cur.execute(
            f"SELECT * FROM {_q(slug)}.tests WHERE {_q(key)} = CAST(? AS {key_type})", [test_id]
        )
    except duckdb.ConversionException:
        return None
    rows = _rows(cur)
    return rows[0] if rows else None


def test_files(
    cur: duckdb.DuckDBPyConnection, slug: str, key: str, key_type: str, test_id: str
) -> list[dict[str, Any]]:
    """Файли тесту в PSI (`test_files`): ім'я, вид, розмір."""
    cur.execute(
        f"SELECT name, kind, bytes FROM {_q(slug)}.test_files"
        f" WHERE {_q(key)} = CAST(CAST(? AS {key_type}) AS VARCHAR) ORDER BY kind, name",
        [test_id],
    )
    return _rows(cur)


def series_rows(
    cur: duckdb.DuckDBPyConnection, slug: str, table: str, key: str, key_value: Any
) -> int:
    cur.execute(f"SELECT count(*) FROM {_q(slug)}.{_q(table)} WHERE {_q(key)} = ?", [key_value])
    return cur.fetchone()[0]


def series_stats(
    cur: duckdb.DuckDBPyConnection, slug: str, table: str, key: str, key_value: Any,
    cols: list[str],
) -> list[dict[str, Any]]:  # fmt: skip
    """Для кожної колонки ряду: кількість значень, мінімум, максимум."""
    if not cols:
        return []
    parts = ", ".join(f"count({_q(c)}), min({_q(c)}), max({_q(c)})" for c in cols)
    cur.execute(f"SELECT {parts} FROM {_q(slug)}.{_q(table)} WHERE {_q(key)} = ?", [key_value])
    row = cur.fetchone()
    return [
        {"column": c, "n": row[3 * i], "min": row[3 * i + 1], "max": row[3 * i + 2]}
        for i, c in enumerate(cols)
    ]


def series_points(
    cur: duckdb.DuckDBPyConnection, slug: str, table: str, key: str, key_value: Any,
    order_col: str, max_points: int,
) -> list[dict[str, Any]]:  # fmt: skip
    """Рівномірна вибірка рядків ряду (не більше `max_points`), за часом."""
    t = f"{_q(slug)}.{_q(table)}"
    cur.execute(
        f"""SELECT * EXCLUDE (_i, _n) FROM (
              SELECT *, row_number() OVER (ORDER BY {_q(order_col)}) - 1 AS _i,
                     count(*) OVER () AS _n
              FROM {t} WHERE {_q(key)} = ?)
            WHERE _n <= ? OR _i % CAST(ceil(_n / ?) AS BIGINT) = 0
            ORDER BY _i""",
        [key_value, max_points, max_points],
    )
    return _rows(cur)
