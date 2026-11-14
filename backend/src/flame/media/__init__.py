"""Віддача важких файлів тесту (raw txt/pdf, mp4) з Railway Volume ($DATA_DIR/flex/raw|media).

Плановано: router.py з /api/media/flex/{test_no}/{path} через FileResponse
з перевіркою, що шлях не виходить за межі data_dir.
"""
