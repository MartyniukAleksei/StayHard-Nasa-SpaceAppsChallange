"""FLEX (PSI-69): тести, часові ряди, сусідні тести, порівняння.

Планований склад:
- schemas.py    — Test, TestSummary, TimeSeries, Comparison
- repository.py — SQL-запити до таблиць tests / ts_* у flame.duckdb
- service.py    — фільтри, детермінований diff, d²-fit, nearest neighbours
- router.py     — /api/studies/flex/tests, /tests/{id}, /tests/{id}/neighbors, /compare
"""
