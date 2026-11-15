"""3D-тур агента: моменти, значення з рядів, заповнювачі, перевірка тексту, інструмент і SSE."""

from pathlib import Path

import duckdb
import pytest

from flame.agent import tools
from flame.core.config import settings
from flame.media import timing
from flame.studies.flex import tour
from tests.test_agent import FakeClient, msg, run, tool_call
from tests.test_flex_api import TESTS

# Рядки з data/flex/raw/100/C09H101.txt (FLEX-100) — ті самі, що у
# frontend/src/features/experiment-3d/lib/log.test.ts: обидві реалізації мають збігатися.
LOG = (
    "Test Point:\t\t\t\tC09H101\n"
    "AS Dispense Start:\t\t\t\n"
    "AS Needles Retract:\t\t\t2010-06-29 08:30:46.767\n"
    "AS Burn to Completion/Igniter On:\t2010-06-29 08:30:46.883\n"
    "AS Igniter Off/Retract Start:\t\t2010-06-29 08:30:48.187\n"
    "AS Retract Completed:\t\t\t2010-06-29 08:30:48.590\n"
)


@pytest.fixture
def cur(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Тест 1: крапля −1…20 с (d = 3 − 0.05·t після запалювання), полум'я до 3 с.

    Тест 3 — без рядів.
    """
    db = tmp_path / "flame.duckdb"
    with duckdb.connect(str(db)) as con:
        con.execute(TESTS)
        for col in ("d0_mm", "dext_mm", "k_mm2_s", "burn_time_s"):
            con.execute(f"ALTER TABLE tests ALTER {col} TYPE DOUBLE")
        con.execute(
            "CREATE TABLE ts_droplet AS SELECT 1::BIGINT AS test_no, "
            "round(i * 0.1 - 1, 1)::DOUBLE AS t_s, "
            "(3.0 - 0.05 * greatest(i * 0.1 - 1, 0))::DOUBLE AS d_mm, "
            "0.0::DOUBLE AS x_mm, 0.0::DOUBLE AS y_mm FROM range(211) r(i)"
        )
        con.execute(  # найбільше полум'я (UV) — на 1.0 с, останній відлік — 3.0 с
            "CREATE TABLE ts_flame_uv AS SELECT 1::BIGINT AS test_no, "
            "round(i * 0.1, 1)::DOUBLE AS t_s, (20 - abs(i - 10) * 0.5)::DOUBLE AS flame_d_mm, "
            "3.0::DOUBLE AS standoff, 0.0::DOUBLE AS droplet_x_mm, 0.0::DOUBLE AS droplet_z_mm "
            "FROM range(31) r(i)"
        )
        con.execute(
            "CREATE TABLE ts_flame_color AS SELECT 1::BIGINT AS test_no, "
            "round(i * 0.1, 1)::DOUBLE AS t_s, 12.0::DOUBLE AS flame_d_mm, 3.0::DOUBLE AS standoff "
            "FROM range(2, 27) r(i)"
        )
    flex_dir = tmp_path / "flex"
    (flex_dir / "raw" / "001").mkdir(parents=True)
    (flex_dir / "raw" / "001" / "A1.txt").write_text(LOG)
    monkeypatch.setitem(settings.__dict__, "flex_dir", flex_dir)
    con = duckdb.connect(str(db), read_only=True)
    yield con.cursor()
    con.close()


def data(cur) -> tour.TourData:
    return tour.load(cur, 1, timing.apparatus_events(1, "A1"))


def step(**kw):
    base = {"moment": "ignition", "t_s": 0, "action": "pause", "camera": "droplet",
            "focus": ["droplet"], "show_frame": False, "labels": []}  # fmt: skip
    return {**base, **kw}


def label(text: str, at: str = "droplet"):
    return {"at": at, "text": text}


def test_apparatus_events_match_the_frontend_parser(cur) -> None:
    ev = timing.apparatus_events(1, "A1")
    assert ev["needles_retract"] == pytest.approx(-1.42)
    assert ev["igniter_on"] == pytest.approx(-1.304)
    assert ev["igniter_retracted"] == pytest.approx(0.403)
    assert timing.apparatus_events(1, "MISSING") == dict.fromkeys(ev)
    assert timing.apparatus_events(1, None) == dict.fromkeys(ev)


def test_moments_resolve_to_seconds_from_ignition(cur) -> None:
    d = data(cur)
    assert tour.resolve_moment(d, "ignition") == (0.0, "data", "log")
    assert tour.resolve_moment(d, "needles_retract")[0] == pytest.approx(-1.42)
    assert tour.resolve_moment(d, "flame_max") == (1.0, "derived", "flame_uv")
    assert tour.resolve_moment(d, "extinction") == (3.0, "derived", "flame_uv")
    assert tour.resolve_moment(d, "end_of_data")[0] == 20.0
    assert tour.resolve_moment(d, "t", 15)[0] == 15.0
    with pytest.raises(tour.TourError, match="between -1.4 and 20.0 s"):
        tour.resolve_moment(d, "t", 60)
    d.events["igniter_on"] = None
    with pytest.raises(tour.TourError, match="does not record"):
        tour.resolve_moment(d, "igniter_on")
    d.flame_uv, d.flame_color = [], []
    with pytest.raises(tour.TourError, match="no measured flame series"):
        tour.resolve_moment(d, "extinction")


def test_values_come_from_the_nearest_sample_within_tolerance(cur) -> None:
    d = data(cur)
    v = tour.values_at(d, 3.04)
    assert v["d"] == pytest.approx(2.85) and v["d2"] == pytest.approx(2.85**2)
    assert v["flame_d_uv"] == pytest.approx(10.0) and "flame_d" not in v  # колір закінчився на 2.6
    assert tour.nearest(d.flame_uv, 3.3) is None  # далі ніж 0.25 с від останнього відліку
    assert set(tour.values_at(d, 10.0)) == {"d", "d2"}


def test_build_fills_placeholders_tags_and_sources(cur) -> None:
    out = tour.build(
        data(cur),
        [
            step(moment="flame_max", action="play", speed=0.1, camera="flame", focus=["flame_uv"],
                 labels=[label("UV flame grows to {flame_d_uv}", "flame_uv")]),
            step(moment="extinction", labels=[label("Flame out at {t}; droplet still {d}")]),
            step(moment="t", t_s=15, show_frame=True,
                 labels=[label("No flame, yet FLEX-001 lost {d_change} in {dt}"),
                         label("Table: d0 {d0}, K {K}", "frame")]),
        ],
    )  # fmt: skip
    s1, s2, s3 = out["steps"]
    assert (s1["t"], s1["action"], s1["speed"], s1["camera"]) == (1.0, "play", 0.25, "flame")
    assert s1["labels"][0] == {
        "at": "flame_uv", "text": "UV flame grows to 20.00 mm", "tags": ["data"], "source": 2,
    }  # fmt: skip
    assert s2["labels"][0]["text"] == "Flame out at 3.0 s; droplet still 2.85 mm"
    assert s2["labels"][0]["tags"] == ["derived", "data"]  # час згасання — з кінця ряду полум'я
    assert s3["show_frame"] is True
    assert s3["labels"][0]["text"] == "No flame, yet FLEX-001 lost 0.60 mm in 12.0 s"
    assert s3["labels"][0]["tags"] == ["derived"]
    assert s3["labels"][1]["text"] == "Table: d0 3.00 mm, K 0.900 mm²/s"
    urls = [s.url for s in out["sources"]]
    assert urls[:3] == [
        "/api/studies/flex/tests/1/timeseries/droplet",
        "/api/studies/flex/tests/1/timeseries/flame_color",
        "/api/studies/flex/tests/1/timeseries/flame_uv",
    ]
    assert urls[s3["labels"][1]["source"]] == "/api/studies/flex/tests/1"
    droplet = out["sources"][0].text
    assert "step 2 at 3.0 s: 2.85 mm (d² 8.12 mm², derived)" in droplet
    assert "Between step 2 and step 3 (12.0 s) the droplet diameter decreased by 0.60 mm" in droplet


def test_log_moment_cites_the_test_log(cur) -> None:
    out = tour.build(
        data(cur), [step(moment="needles_retract", labels=[label("Needles let go at {t}")])]
    )
    lb = out["steps"][0]["labels"][0]
    assert lb["text"] == "Needles let go at 1.4 s before ignition" and lb["tags"] == ["data"]
    assert out["sources"][lb["source"]].url == "/api/media/flex/files/raw/001/A1.txt"


@pytest.mark.parametrize(
    ("steps", "error"),
    [
        ([step(labels=[label("Droplet is 2.5 mm wide")])], "do not write numbers"),
        ([step(labels=[label("Shrinks by {rate}")])], "unknown placeholder"),
        ([step(labels=[label("x" * 91)])], "longer than 90"),
        ([step(labels=[label("a"), label("b"), label("c")])], "at most 2 labels"),
        ([step()] * 7, "1-6 steps"),
        ([], "1-6 steps"),
        ([step(moment="boom")], "moment must be one of"),
        ([step(camera="top")], "camera must be one of"),
        ([step(focus=["chamber"])], "focus must be one of"),
        ([step(labels=[label("Lost {d_change}")])], "step 1 has none"),
        ([step(moment="t", t_s=10, labels=[label("Flame {flame_d}")])], "no color-camera flame"),
        ([step(labels=[label("Ends at {dext}")])], "not recorded"),
    ],
)
def test_bad_steps_are_rejected_with_a_message_for_the_model(cur, steps, error) -> None:
    with pytest.raises(tour.TourError, match=error):
        tour.build(data(cur), steps)


def test_test_names_and_formulas_are_not_numbers(cur) -> None:
    for text in ("FLEX-155 burns in O2/N2/CO2", "Test #155: d² falls", "Still {d} at {t}"):
        assert tour.check_text(text, "step 1")


def test_tool_returns_tour_event_and_citable_values(cur) -> None:
    out = tools.show_in_3d(
        cur, {"test_no": 1, "steps": [step(moment="extinction", labels=[label("Still {d}")])]}
    )
    ev = out.events[0]
    assert ev["event"] == "tour" and ev["data"]["test_no"] == 1
    assert ev["data"]["steps"][0]["labels"][0]["text"] == "Still 2.85 mm"
    assert ev["data"]["sources"][0] == {
        "url": "/api/studies/flex/tests/1/timeseries/droplet",
        "title": "FLEX-001 droplet time series — values at the walkthrough steps",
    }
    blocks = out.content()
    assert all(b["type"] == "search_result" for b in blocks)
    assert "2.85 mm" in " ".join(b["content"][0]["text"] for b in blocks)
    assert tools.status_text("show_in_3d", {}) == "Preparing 3D walkthrough…"
    with pytest.raises(tools.ToolError, match="no measured droplet series"):
        tools.show_in_3d(cur, {"test_no": 3, "steps": [step()]})
    with pytest.raises(tools.ToolError, match="not found"):
        tools.show_in_3d(cur, {"test_no": 999, "steps": [step()]})
    with pytest.raises(tools.ToolError, match="do not write numbers"):
        tools.show_in_3d(cur, {"test_no": 1, "steps": [step(labels=[label("d = 2.85 mm")])]})


def test_tool_is_offered_to_the_model_without_strict_schema() -> None:
    names = [t["name"] for t in tools.TOOLS]
    assert "show_in_3d" in names and "show_in_3d" not in tools.STRICT
    schema = tools.TOUR_TOOL["input_schema"]["properties"]["steps"]["items"]["properties"]
    assert schema["moment"]["enum"] == tour.MOMENTS and schema["camera"]["enum"] == tour.CAMERAS


def test_tour_event_reaches_the_stream(cur) -> None:
    client = FakeClient(
        [
            msg(
                [tool_call("show_in_3d", {"test_no": 1, "steps": [step(labels=[label("{d}")])]})],
                stop="tool_use",
            ),
            msg([{"type": "text", "text": "The 3D walkthrough is starting."}]),
            msg([{"type": "text", "text": "The 3D walkthrough is starting."}]),  # перезапит цитат
        ]
    )
    events = run(client, cur, "What happens in test 1?")
    status = next(e for e in events if e["event"] == "status")
    assert status["data"] == {"tool": "show_in_3d", "text": "Preparing 3D walkthrough…"}
    tour_ev = next(e for e in events if e["event"] == "tour")
    assert tour_ev["data"]["id"] == "tu_1-0"
    assert tour_ev["data"]["steps"][0]["labels"][0]["text"] == "3.00 mm"
    result = client.calls[1]["messages"][-1]["content"][0]["content"]
    assert any("3.00 mm" in b["content"][0]["text"] for b in result)
