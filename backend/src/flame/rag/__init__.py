"""RAG по текстах FLEX: коментарі TestSheet, docs/*.pdf, about.json (публікації/DOI).

Плановано:
- chunking.py — розбиття тексту на чанки з метаданими (джерело, тест, сторінка)
- embed.py    — ембеддинги (провайдер обирається, коли беремося за агента)
- search.py   — векторний пошук у таблиці `chunks` flame.duckdb (vss / array_cosine_similarity)
Індекс будується офлайн у flame.ingest.build_db, в рантаймі лише читається.
"""
