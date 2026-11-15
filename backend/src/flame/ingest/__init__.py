"""Офлайн-пайплайн даних (не викликається API).

1. psi_flex  — PSI API → $DATA_DIR/flex (знімок FLEX, read-only джерело)
   psi_cfi   — PSI API → $DATA_DIR/cfi (знімок CFI)
2. build_db  — $DATA_DIR/flex (+ знімки інших досліджень через psi_studies) →
               $DATA_DIR/build/flame.duckdb (таблиці, схеми досліджень, ряди, RAG-чанки)
3. bootstrap — при старті контейнера: архіви DATA_ARCHIVE_URL(S) → Volume + build_db
"""
