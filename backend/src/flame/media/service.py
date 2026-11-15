"""Файли FLEX на Volume: безпечне розв'язання шляху і перелік файлів тесту/документів.

Віддаємо лише з дозволених тек усередині settings.flex_dir. Будь-який шлях, що після
resolve() виходить за межі дозволеної теки (../, абсолютний, симлінк), відхиляється.
"""

from pathlib import Path

from flame.core.config import settings

ALLOWED_ROOTS = ("raw", "media", "docs")

KIND_RULES: tuple[tuple[str, str], ...] = (
    ("_summary.pdf", "Summary report (PDF)"),
    ("_testsheet.pdf", "Test sheet (PDF)"),
    ("_testsheet.txt", "Test sheet (text)"),
    ("_dropletdata.txt", "Droplet diameter series"),
    ("_lluvdata.txt", "Flame (UV camera) series"),
    ("_colorcamdata.txt", "Flame (color camera) series"),
    ("_chamber_readings.txt", "Chamber pressure and temperature"),
    ("_radiometer_readings.txt", "Radiometer readings"),
    ("_comments.txt", "Researcher comments"),
    (".mp4", "Video"),
)


def resolve_file(rel_path: str) -> Path | None:
    """Шлях відносно flex_dir → файл, або None, якщо він поза дозволеними теками."""
    base = settings.flex_dir.resolve()
    parts = Path(rel_path).parts
    if not parts or parts[0] not in ALLOWED_ROOTS:
        return None
    candidate = (base / rel_path).resolve()
    root = (base / parts[0]).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        return None
    return candidate


def describe(name: str) -> str:
    low = name.lower()
    for suffix, label in KIND_RULES:
        if low.endswith(suffix):
            return label
    return "Instrument settings / log (text)"


def _listing(folder: Path) -> list[dict[str, object]]:
    if not folder.is_dir():
        return []
    base = settings.flex_dir
    return [
        {
            "name": f.name,
            "path": f.relative_to(base).as_posix(),
            "bytes": f.stat().st_size,
            "kind": describe(f.name),
        }
        for f in sorted(folder.iterdir())
        if f.is_file() and not f.name.startswith(".")
    ]


def test_dir(test_no: int) -> str:
    return f"{test_no:03d}"


def list_test_files(test_no: int) -> list[dict[str, object]]:
    d = test_dir(test_no)
    return _listing(settings.flex_dir / "media" / d) + _listing(settings.flex_dir / "raw" / d)


def list_videos(test_no: int) -> list[dict[str, object]]:
    return _listing(settings.flex_dir / "media" / test_dir(test_no))


def tests_with_video() -> set[int]:
    media = settings.flex_dir / "media"
    if not media.is_dir():
        return set()
    return {
        int(d.name)
        for d in media.iterdir()
        if d.is_dir() and d.name.isdigit() and any(d.glob("*.mp4"))
    }


def list_documents() -> list[dict[str, object]]:
    """NASA-документи дослідження, згруповані за теками PSI (Science, Engineering, …)."""
    docs = settings.flex_dir / "docs"
    if not docs.is_dir():
        return []
    groups = []
    for cat in sorted(p for p in docs.iterdir() if p.is_dir()):
        files = [
            {**f, "title": str(f["name"]).removeprefix(f"{cat.name}_").rsplit(".", 1)[0]}
            for f in _listing(cat)
        ]
        if files:
            groups.append({"category": cat.name, "files": files})
    return groups
