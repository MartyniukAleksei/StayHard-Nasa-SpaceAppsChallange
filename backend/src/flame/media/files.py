"""Локальні файли знімка дослідження для /api/media/{slug}/files/{path}."""

from pathlib import Path

from flame.core.config import settings

ALLOWED_DIRS = ("raw", "docs", "media")  # що з каталогу знімка можна віддавать


def study_dirs() -> dict[str, Path]:
    return {"flex": settings.flex_dir}


def resolve(study: str, path: str) -> Path | None:
    """Шлях до файлу або None, якщо дослідження/каталог не дозволені чи файлу немає.

    Захист від виходу за межі: шлях нормалізується й має лишитися всередині
    дозволеного підкаталогу знімка (у т.ч. після розкриття symlink-ів).
    """
    base = study_dirs().get(study)
    if base is None:
        return None
    parts = Path(path).parts
    if not parts or parts[0] not in ALLOWED_DIRS:
        return None
    root = (base / parts[0]).resolve()
    target = (base / path).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        return None
    return target
