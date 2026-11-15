"""BASS-II: розпізнавання накладки відео й автозвірка (flame.ingest.bass2_video), без мережі."""

from pathlib import Path

import numpy as np
import pytest

from flame.ingest import bass2_video as bv


def render(text: str, x0: int = 11, row: int = 50, shift: tuple[int, int] = (0, 0)) -> np.ndarray:
    """Синтетичний кадр накладки: кожен символ — його перший шаблон на сітці з кроком PITCH."""
    frame = np.zeros((bv.OV_H, bv.OV_W), dtype=np.uint8)
    first = {c: i for i, c in reversed(list(enumerate(bv.LABELS)))}
    for i, ch in enumerate(text):
        if ch == " ":
            continue
        g = bv.REPS[first[ch]].reshape(bv.CH, bv.CW).astype(bool)
        x = int(round(x0 + bv.PITCH * i)) + shift[1]
        y = row + shift[0]
        frame[y : y + bv.CH, x : x + bv.CW][g] = 255
    return frame


def test_glyph_templates_cover_every_digit() -> None:
    assert bv.REPS.shape == (len(bv.LABELS), bv.CH * bv.CW)
    assert set("0123456789-./") <= set(bv.LABELS)


@pytest.mark.parametrize("shift", [(0, 0), (1, -1), (-2, 2)])
def test_overlay_row_reads_back_even_when_shifted(shift: tuple[int, int]) -> None:
    text = "  -2    6   49  0.6"
    frame = render(text, shift=shift)

    assert bv.read_row(frame, 50, 11, len(text)) == text
    assert bv.parse_values(text) == {"fuel": -2.0, "air": 6.0, "fan": 49.0, "rad": 0.6}


def test_every_digit_is_told_apart() -> None:
    text = "0123456789"
    assert bv.read_row(render(text), 50, 11, len(text)) == text


def test_clock_and_midnight() -> None:
    assert bv.parse_clock("07/22/14 17 30 26") == 17 * 3600 + 30 * 60 + 26
    assert bv.parse_clock("07/22/14 1? 30 26") is None
    # запис, що перетинає північ: годинник 23:59:58 → 00:00:02, час відео 0…4 с
    clock = [86398, 86399, 0, 1, 2]
    off, ok = bv.clock_consistency(clock, [0.0, 1.0, 2.0, 3.0, 4.0])
    assert off == 86398 and ok == 1.0


def test_plateaus_and_log_match() -> None:
    t = [float(i) for i in range(40)]
    v = [49.0] * 15 + [44.0] * 3 + [42.0] * 22  # 44 тримається лише 2 с — не ступінь
    steps = [s for _, s in bv.plateaus(t, v)]
    assert steps == [49, 42]
    assert bv.log_numbers("49, 44, 42, 41 (5, 2, 0)", 30, 130) == [49.0, 44.0, 42.0, 41.0]
    assert bv.log_match([49.0, 44.0, 42.0, 41.0], steps) == 0.75  # 41 у межах допуску від 42
    assert bv.log_match([], steps) is None


def test_main_video_skips_stills_fragments_and_second_view(tmp_path: Path) -> None:
    csv_path = tmp_path / "test_files.csv"
    csv_path.write_text(
        "test_id,kind,name,version,bytes\n"
        "O13a,video,PSI-25_Raw Data_BASS_GMT202_TEST_O13a_Still_Sequence.mp4,2,9\n"
        "O13a,video,PSI-25_Raw Data_BASS_GMT202_TEST_O13a_LOS_Portion_1741-1743.mp4,2,9\n"
        "O13a,video,PSI-25_Raw Data_BASS_GMT202_TEST_O13a_2ND_VIEW.mp4,2,9\n"
        "O13a,video,PSI-25_Raw Data_BASS_GMT202_TEST_O13a.mp4,2,9\n"
        "O13a,photo_archive,PSI-25_Raw Data_O13a.zip,2,9\n",
        encoding="utf-8",
    )
    assert bv.main_video("O13a", csv_path)["name"].endswith("TEST_O13a.mp4")
    assert bv.main_video("B1", csv_path) is None


def test_median_filter_drops_single_misreads() -> None:
    a = np.array([6, 6, 3, 6, 6, np.nan, 6], dtype=float)
    assert list(bv.median_filter(a)) == [6, 6, 6, 6, 6, 6, 6]
