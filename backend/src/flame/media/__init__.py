"""Медіа тестів FLEX.

- Кадри камер з PSI на вимогу (ADR 0005). Архіви кадрів (~900 ГБ) лишаються в PSI;
  `psi.py` читає з S3 лише каталог zip і потрібний кадр через HTTP Range, `service.py`
  конвертує сирий кадр (16-біт TIFF / BMP) у JPEG, `router.py` — /api/media/flex/{test_no}/cameras….
- Локальні файли знімка (`files.py`): /api/media/flex/files/{path} — raw txt/pdf, docs, mp4 з
  $DATA_DIR/flex із перевіркою, що шлях не виходить за межі дозволених каталогів. На ці URL
  ведуть посилання-джерела агента (flame.core.citations, ADR 0006).
"""
