"""Офлайн-пайплайн даних (не викликається API).

1. psi_flex  — PSI API → $DATA_DIR/flex (знімок FLEX, read-only джерело)
2. build_db  — $DATA_DIR/flex → $DATA_DIR/build/flame.duckdb (таблиці, ряди, RAG-чанки)
"""
