"""RAG по текстах досліджень (зараз FLEX): коментарі TestSheet, docs/*.pdf|docx, about.json.

- sources/   — витягування тексту, модуль на дослідження (`flex.py` = PSI-69)
- chunking   — Document → Chunk (метадані, цитата)
- embed      — локальні ембеддинги (fastembed, bge-small-en-v1.5)
- index      — офлайн-збірка таблиці `chunks` + FTS (лише з flame.ingest.build_db)
- repository → service → router — гібридний пошук (вектор + BM25, RRF), GET /api/rag/search
- eval       — recall@k на контрольному наборі `evalsets/*.jsonl`
Документація: docs/rag/.
"""
