"""Кадри для агента: час від запалювання з логу, найближчий кадр, події й пропозиції."""

from pathlib import Path
from types import SimpleNamespace

import pytest

from flame.agent import tools
from flame.core.config import settings
from flame.media import service as media_service
from flame.media import timing
from tests.test_agent import cur  # noqa: F401  — фікстура з тестовою БД

LOG = (
    "AS Igniter On:\t\t2010-06-29 08:30:46.883\n"
    "AS Igniter Off/Retract Start:\t\t2010-06-29 08:30:48.187\n"
)


def test_ignition_time_from_log_and_frame_times(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setitem(settings.__dict__, "flex_dir", tmp_path)
    (tmp_path / "raw" / "100").mkdir(parents=True)
    (tmp_path / "raw" / "100" / "C09H101.txt").write_text(LOG)
    ign = timing.ignition_epoch_ms(100, "C09H101")
    assert ign == timing._epoch_ms("2010-06-29", "08:30:48.187")
    assert timing.ignition_epoch_ms(100, "MISSING") is None
    idx = media_service.FrameIndex(("a", "b", "c"), (0, 8246, None), "2010-06-29T08:30:39.941852")
    times = timing.frame_times(idx, ign)
    assert times[0] == pytest.approx(-8.245, abs=1e-3) and times[2] is None
    assert times[1] == pytest.approx(0.001, abs=1e-3)
    assert timing.nearest(times, 0.0) == 1


@pytest.fixture
def fake_media(monkeypatch, tmp_path: Path):
    monkeypatch.setitem(settings.__dict__, "flex_dir", tmp_path)
    (tmp_path / "raw" / "001").mkdir(parents=True)
    (tmp_path / "raw" / "001" / "A1.txt").write_text(
        LOG.replace("2010-06-29 08:30:48.187", "2009-03-05 10:00:00.000")
    )
    cam = SimpleNamespace(camera="D", info=SimpleNamespace(label="Color"))
    idx = media_service.FrameIndex(
        tuple(f"f{i}" for i in range(50)), tuple(i * 100 for i in range(50)), "2009-03-05T10:00:00"
    )
    monkeypatch.setattr(media_service, "camera", lambda _cur, n, c: cam)
    monkeypatch.setattr(media_service, "frame_index", lambda c: idx)
    monkeypatch.setattr(media_service, "frame_jpeg", lambda c, i, side: b"\xff\xd8jpeg")
    return cam


def test_find_frame_at_time_event_and_source(cur, fake_media) -> None:  # noqa: F811
    out = tools.find_frame(cur, {"test_no": 1, "event": "time", "t_s": 2.04, "camera": "D"})
    ev = out.events[0]["data"]
    assert ev["index"] == 20 and ev["t_s"] == 2.0
    assert ev["url"] == "/api/media/flex/1/cameras/D/frames/20.jpg?max_side=640"
    assert out.sources[0].url == ev["url"] and "2.00 s after ignition" in out.sources[0].text
    with pytest.raises(tools.ToolError, match="no frame near"):
        tools.find_frame(cur, {"test_no": 1, "event": "time", "t_s": 60, "camera": "D"})


def test_look_at_frames_returns_images_and_events(cur, fake_media) -> None:  # noqa: F811
    out = tools.look_at_frames(cur, {"test_no": 1, "camera": "D", "t_s": [0.0, 1.0, 9, 9, 9]})
    blocks = out.content()
    assert [b["type"] for b in blocks] == ["text", "image"] * 4  # не більше 4 кадрів
    assert blocks[1]["source"]["media_type"] == "image/jpeg"
    assert len(out.events) == 4


def test_video_and_replay_proposals(cur) -> None:  # noqa: F811
    with pytest.raises(tools.ToolError, match="no onboard video"):
        tools.propose_action(
            cur, {"action": "open_video", "label": "v", "test_nos": [1], "t_s": 0, "explorer": {}}
        )
    out = tools.propose_action(
        cur, {"action": "open_replay", "label": "r", "test_nos": [1], "t_s": 3.456, "explorer": {}}
    )
    assert out.events[0]["data"]["params"] == {"test_nos": [1], "t_s": 3.46}
    with pytest.raises(tools.ToolError, match="no measured series"):
        tools.propose_action(
            cur, {"action": "open_replay", "label": "r", "test_nos": [3], "t_s": 0, "explorer": {}}
        )
