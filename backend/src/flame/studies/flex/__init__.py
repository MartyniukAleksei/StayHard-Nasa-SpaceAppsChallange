"""FLEX (PSI-69): тести, часові ряди, сусідні тести, порівняння.

- fields.py     — каталог полів (whitelist для фільтрів/сортування), сигнали часових рядів
- schemas.py    — Filter, TestSummary, TestDetail, TimeSeries, Comparison…
- repository.py — параметризований SQL до tests / ts_*
- service.py    — query_tests, get_test, get_timeseries, neighbors, compare_tests;
                  кожен результат несе `sources` (flame.core.citations) для агента
- router.py     — /api/studies/flex/{fields,tests,tests/{n},…/timeseries/{signal},
                  …/neighbors,compare}
- pages/        — відповіді під сторінки UI (огляд, дослідник, звіт тесту, replay, бібліотека)
"""
