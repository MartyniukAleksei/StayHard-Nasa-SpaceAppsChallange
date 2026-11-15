"""ACME CFI-G (PSI-159): газові полум'я на пористому сферичному пальнику, МКС 2021.

- schemas.py    — RegimeMap (карта режимів: усі тести з таблиці `cfig.tests` + паспорт + факти)
- repository.py — параметризований SQL до схеми `cfig` (див. docs/data/psi-studies.md)
- service.py    — збирає відповідь, виводить прапорці з тексту таблиці (cool_flame — derived)
- router.py     — /api/studies/cfig/regime
"""
