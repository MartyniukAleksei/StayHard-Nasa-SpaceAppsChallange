"""Віддача файлів знімка дослідження (raw txt/pdf, docs, mp4) з $DATA_DIR.

GET /api/media/{study}/{path} — на ці URL ведуть посилання-джерела (flame.core.citations).
Лише локальний знімок; файли шару C (архіви кадрів у PSI) — окрема задача.
"""
