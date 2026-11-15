"""Медіа тестів FLEX.

Зараз: кадри камер з PSI на вимогу (ADR 0005). Архіви кадрів (~900 ГБ) лишаються в PSI;
`psi.py` читає з S3 лише каталог zip і потрібний кадр через HTTP Range, `service.py`
конвертує сирий кадр (16-біт TIFF / BMP) у JPEG, `router.py` — /api/media/flex/{test_no}/cameras….

Плановано: віддача локальних файлів з Volume ($DATA_DIR/flex/raw|media: txt/pdf, mp4)
через FileResponse з перевіркою, що шлях не виходить за межі data_dir.
"""
