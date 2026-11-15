"""Інші дослідження PSI в БД (CFI, ACME CFI-G, BASS-II, SAME-R, Saffire-II): схема на дослідження.

- notes.py      — що треба знати про дані кожного дослідження, колонки за замовчуванням
- schemas.py    — Filter і відповіді API
- repository.py — SQL; ідентифікатори лише після перевірки за реєстром і information_schema
- service.py    — overview, query_tests, aggregate, get_test, timeseries; усе несе `sources`
- router.py     — /api/studies/{slug}, …/tests, …/aggregate, …/tests/{id},
                  …/tests/{id}/timeseries/{series}
"""
