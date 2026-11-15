"""Агент без мережі: фейковий клієнт Anthropic відтворює заготовлені відповіді моделі."""

import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import duckdb
import pytest
from anthropic.types.beta import BetaMessage
from fastapi.testclient import TestClient

from flame.agent import loop
from flame.agent import router as agent_router
from flame.agent.citations import build_answer
from flame.agent.limits import Budget, RateLimiter, cost_usd
from flame.agent.schemas import HistorySource, HistoryTurn
from flame.core.config import Settings, settings
from flame.main import app
from tests.test_flex_api import TESTS

CITE = {
    "type": "search_result_location",
    "source": "/api/studies/flex/tests/1",
    "title": "FLEX-001 — FLEX experiment table",
    "cited_text": "pressure 0.700 atm",
    "search_result_index": 1,
    "start_block_index": 0,
    "end_block_index": 0,
}


def msg(content: list[dict[str, Any]], stop: str = "end_turn") -> BetaMessage:
    return BetaMessage.model_validate(
        {
            "id": "msg_1",
            "type": "message",
            "role": "assistant",
            "model": "claude-sonnet-5-5",
            "content": content,
            "stop_reason": stop,
            "stop_sequence": None,
            "usage": {"input_tokens": 1000, "output_tokens": 200, "cache_read_input_tokens": 0},
        }
    )


def tool_call(name: str, args: dict[str, Any], id_: str = "tu_1") -> dict[str, Any]:
    return {"type": "tool_use", "id": id_, "name": name, "input": args}


class FakeStream:
    def __init__(self, message: BetaMessage) -> None:
        self.message = message

    def __enter__(self) -> "FakeStream":
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def __iter__(self):
        for block in self.message.content:
            if block.type == "text":
                yield SimpleNamespace(type="text", text=block.text)

    def get_final_message(self) -> BetaMessage:
        return self.message


class FakeClient:
    def __init__(self, script: list[BetaMessage]) -> None:
        self.script = list(script)
        self.calls: list[dict[str, Any]] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))

    def _stream(self, **kwargs: Any) -> FakeStream:
        # копія messages: цикл дописує в той самий список
        self.calls.append({**kwargs, "messages": list(kwargs["messages"])})
        return FakeStream(self.script.pop(0))


@pytest.fixture
def cur(tmp_path: Path):
    db = tmp_path / "flame.duckdb"
    with duckdb.connect(str(db)) as con:
        con.execute(TESTS)
        for col in ("p_atm", "x_o2", "x_n2", "x_co2", "x_he", "d0_mm", "dext_mm", "k_mm2_s",
                    "burn_time_s", "ts_temperature_k"):  # fmt: skip
            con.execute(f"ALTER TABLE tests ALTER {col} TYPE DOUBLE")
    con = duckdb.connect(str(db), read_only=True)
    yield con.cursor()
    con.close()


def run(client: FakeClient, cur, text: str = "Heptane tests at low pressure?", **cfg: Any):
    s = Settings(anthropic_api_key="test", **cfg)
    return list(loop.run_turn(client, cur, [HistoryTurn(role="user", text=text)], s))


def test_tool_round_then_cited_answer(cur) -> None:
    client = FakeClient(
        [
            msg(
                [
                    tool_call(
                        "query_tests",
                        {
                            "filters": [
                                {"field": "fuel", "op": "eq", "value": "Heptane"},
                                {"field": "p_atm", "op": "lt", "value": "0.75"},
                            ],
                            "sort": "test_no",
                            "descending": False,
                            "limit": 10,
                        },
                    )
                ],
                stop="tool_use",
            ),  # fmt: skip
            msg([{"type": "text", "text": "FLEX-001 ran at 0.7 atm.", "citations": [CITE]}]),
        ]
    )
    events = run(client, cur)
    names = [e["event"] for e in events]
    assert "status" in names and names[-1] == "done"
    done = events[-1]["data"]
    assert done["answer"]["sources"][0]["url"] == "/api/studies/flex/tests/1"
    assert done["rewritten"] is False
    assert done["cost_usd"] == pytest.approx(2 * cost_usd("claude-sonnet-5-5", {
        "input_tokens": 1000, "output_tokens": 200}))  # fmt: skip

    # другий запит несе результат інструмента лише з search_result-блоків
    tool_result = client.calls[1]["messages"][-1]["content"][0]
    assert tool_result["type"] == "tool_result" and "is_error" not in tool_result
    kinds = {b["type"] for b in tool_result["content"]}
    assert kinds == {"search_result"}
    assert tool_result["content"][0]["source"].startswith("/api/studies/flex/tests?f=")

    first = client.calls[0]
    assert first["model"] == "claude-sonnet-5-5"
    assert first["fallbacks"] == "default"
    assert all(t["strict"] for t in first["tools"])
    assert first["tools"][-1]["cache_control"] == {"type": "ephemeral"}
    assert "tool_choice" not in first


def test_uncited_answer_is_rewritten_once(cur) -> None:
    client = FakeClient(
        [
            msg([{"type": "text", "text": "FLEX-001 ran at 0.7 atm."}]),
            msg([{"type": "text", "text": "FLEX-001 ran at 0.7 atm.", "citations": [CITE]}]),
        ]
    )
    events = run(client, cur)
    assert "rewrite" in [e["event"] for e in events]
    assert events[-1]["data"]["rewritten"] is True
    rewrite_msg = client.calls[1]["messages"][-1]["content"]
    assert "without a citation" in rewrite_msg and "FLEX-001 ran at 0.7 atm." in rewrite_msg
    assert not any(s["uncited"] for s in events[-1]["data"]["answer"]["segments"])


def test_step_limit_forces_answer_and_explains(cur) -> None:
    call = tool_call("get_test", {"test_no": 1})
    client = FakeClient(
        [
            msg([call], stop="tool_use"),
            msg([{"type": "text", "text": "Done.", "citations": [CITE]}]),
        ]
    )
    events = run(client, cur, agent_max_steps=2)
    assert client.calls[1]["tool_choice"] == {"type": "none"}
    limits = [e["data"] for e in events if e["event"] == "limit"]
    assert limits and limits[0]["reason"] == "max_steps"
    assert "2 steps" in limits[0]["message"]


def test_refusal_is_explained(cur) -> None:
    client = FakeClient([msg([], stop="refusal")])
    events = run(client, cur)
    assert any(e["event"] == "limit" and e["data"]["reason"] == "refusal" for e in events)
    assert events[-1]["event"] == "done"


def test_bad_tool_input_returns_error_to_model(cur) -> None:
    bad = {"filters": [{"field": "p_atm", "op": "lt", "value": "abc"}], "sort": "test_no",
           "descending": False, "limit": 5}  # fmt: skip
    client = FakeClient(
        [
            msg([tool_call("query_tests", bad)], stop="tool_use"),
            msg([{"type": "text", "text": "No data.", "citations": []}]),
        ]
    )
    run(client, cur)
    result = client.calls[1]["messages"][-1]["content"][0]
    assert result["is_error"] is True and "expected number" in result["content"]


def test_empty_query_is_a_citable_source(cur) -> None:
    args = {"filters": [{"field": "x_co2", "op": "gt", "value": "0.1"}], "sort": "test_no",
            "descending": False, "limit": 5}  # fmt: skip
    client = FakeClient(
        [
            msg([tool_call("query_tests", args)], stop="tool_use"),
            msg([{"type": "text", "text": "None.", "citations": []}]),
        ]
    )
    run(client, cur)
    [block] = client.calls[1]["messages"][-1]["content"][0]["content"]
    assert block["type"] == "search_result"
    assert block["content"][0]["text"].startswith("No FLEX tests match these filters")


def test_history_is_condensed_and_deterministic() -> None:
    history = [
        HistoryTurn(role="user", text="Q1", page_context={"route": "/compare", "ids": [1, 2]}),
        HistoryTurn(role="assistant", text="A1", sources=[HistorySource(n=1, url="/u", title="T")]),
        HistoryTurn(role="user", text="Q2"),
    ]
    msgs = loop.build_messages(history)
    assert msgs[0]["content"].startswith('<page_context>\n{"ids": [1, 2], "route"')
    assert msgs[1] == {"role": "assistant", "content": "A1\n\nSources used: [1] T (/u)"}
    assert loop.build_messages(history) == msgs


def test_citations_are_checked_per_line() -> None:
    blocks = [
        {"type": "text", "text": "- **FLEX-001:** "},
        {"type": "text", "text": "burned at 0.7 atm", "citations": [CITE]},
        {
            "type": "text",
            "text": "\n- FLEX-002 burned 4.2 s.\n\nGeneral knowledge: K is 0.5 mm²/s.",
        },
    ]
    seg = build_answer(blocks).segments
    assert [s.uncited for s in seg] == [False, False, True]
    assert (
        build_answer([{"type": "text", "text": "General knowledge: 3.0 mm drops."}])
        .segments[0]
        .general
    )


def test_rate_limiter_and_cost() -> None:
    rl = RateLimiter(per_minute=2, per_day=3)
    assert rl.check("ip", now=0) is None and rl.check("ip", now=1) is None
    assert rl.check("ip", now=2) == 59
    assert rl.check("ip", now=61) is None
    assert rl.check("ip", now=200) > 80000  # денний ліміт
    usage = {"input_tokens": 1_000_000, "output_tokens": 0, "cache_read_input_tokens": 1_000_000}
    assert cost_usd("claude-sonnet-5-5", usage) == pytest.approx(2.10)


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch):
    cached = (agent_router.rate_limiter, agent_router.budget, agent_router.client)
    for fn in cached:
        fn.cache_clear()
    monkeypatch.setattr(settings, "anthropic_api_key", "test")
    yield TestClient(app)
    for fn in cached:
        fn.cache_clear()


BODY = {"messages": [{"role": "user", "text": "Hi"}]}


def test_api_explains_missing_key(api, monkeypatch) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    r = api.post("/api/agent", json=BODY)
    assert r.status_code == 503 and r.json()["detail"]["reason"] == "not_configured"


def test_api_rate_limit_and_budget(api, monkeypatch) -> None:
    monkeypatch.setattr(agent_router, "rate_limiter", lambda: RateLimiter(0, 10))
    r = api.post("/api/agent", json=BODY)
    assert r.status_code == 429
    assert r.json()["detail"]["reason"] == "rate_limit" and "Retry-After" in r.headers
    spent = Budget(1.0)
    spent.add(2.0)
    monkeypatch.setattr(agent_router, "budget", lambda: spent)
    assert api.post("/api/agent", json=BODY).json()["detail"]["reason"] == "budget"


def test_api_rejects_bad_history(api) -> None:
    r = api.post("/api/agent", json={"messages": [{"role": "assistant", "text": "x"}]})
    assert r.status_code == 422


def test_api_streams_sse(api, monkeypatch, cur) -> None:
    fake = FakeClient([msg([{"type": "text", "text": "Hello.", "citations": []}])])
    monkeypatch.setattr(agent_router, "client", lambda: fake)
    monkeypatch.setattr(agent_router, "get_connection", lambda: SimpleNamespace(cursor=cur.cursor))
    r = api.post("/api/agent", json=BODY)
    assert r.headers["content-type"].startswith("text/event-stream")
    events = [b for b in r.text.split("\n\n") if b]
    assert events[0].startswith("event: text_start")
    last = events[-1].split("\n")
    assert last[0] == "event: done" and json.loads(last[1][6:])["answer"]["segments"]


def test_proposal_and_highlight_events(cur) -> None:
    client = FakeClient(
        [
            msg(
                [
                    tool_call(
                        "propose_action",
                        {
                            "action": "open_compare",
                            "label": "Compare",
                            "test_nos": [1, 2],
                            "explorer": {},
                        },
                        "tu_a",
                    ),
                    tool_call(
                        "highlight_params", {"fields": ["p_atm", "bogus"], "test_nos": [1]}, "tu_b"
                    ),
                ],
                stop="tool_use",
            ),  # fmt: skip
            msg([{"type": "text", "text": "Here you go.", "citations": []}]),
        ]
    )
    events = run(client, cur)
    prop = next(e["data"] for e in events if e["event"] == "proposal")
    assert prop == {"action": "open_compare", "label": "Compare",
                    "params": {"test_nos": [1, 2]}, "id": "tu_a-0"}  # fmt: skip
    hl = next(e["data"] for e in events if e["event"] == "highlight")
    assert hl["fields"] == ["p_atm"] and hl["test_nos"] == [1]
    results = client.calls[1]["messages"][-1]["content"]
    assert [r.get("is_error") for r in results] == [None, None]
    assert results[0]["content"][0]["type"] == "text"


@pytest.mark.parametrize(
    "args, error",
    [
        ({"action": "open_compare", "test_nos": [1]}, "2 or 3 tests"),
        ({"action": "open_compare", "test_nos": [1, 2, 3, 99]}, "2 or 3 tests"),
        ({"action": "open_test", "test_nos": [99]}, "no such tests"),
    ],
)
def test_proposal_validation(cur, args, error) -> None:
    from flame.agent import tools

    with pytest.raises(tools.ToolError, match=error):
        tools.propose_action(cur, {"label": "x", "explorer": {}, **args})


def test_open_tests_keeps_only_known_facet_values(cur) -> None:
    from flame.agent import tools

    out = tools.propose_action(
        cur,
        {"action": "open_tests", "label": "x", "test_nos": [],
         "explorer": {"fuel": ["Heptane", "Kerosene"], "o2": ["30+"], "tag": []}},
    )  # fmt: skip
    assert out.events[0]["data"]["params"] == {"explorer": {"fuel": ["Heptane"], "o2": ["30+"]}}


def test_explorer_facets_match_frontend() -> None:
    """Значення фасетів мають збігатися з features/explorer/lib/filter.ts."""
    import re

    from flame.agent.tools import EXPLORER_FACETS

    ts = (Path(__file__).parents[2] / "frontend/src/features/explorer/lib/filter.ts").read_text()
    for key, values in EXPLORER_FACETS.items():
        block = re.search(rf'key: "{key}",.*?options: \[(.*?)\]\s*,\s*values', ts, re.S)
        assert block, key
        front = re.findall(r'value: "([^"]+)"', block.group(1))
        assert set(values) - {"all"} == set(front), key
