"""Дані для сторінок UI FLEX (Огляд, Дослідник, Тест, Бібліотека): готові під екран відповіді.

- schemas.py    — Overview, TestSummary (рядок Дослідника), TestDetail (звіт 3A), Replay, Library
- repository.py — параметризований SQL: пресети, факти, обмеження, ряди для replay і CSV
- service.py    — збирає відповіді; файли й документи — з flame.media.files
- router.py     — /api/studies/flex/{overview,library,explorer,videos},
                  /api/studies/flex/tests/{n}/{report,replay,series.csv}
"""
