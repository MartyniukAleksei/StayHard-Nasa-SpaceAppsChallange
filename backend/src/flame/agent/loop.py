"""Цикл агента: модель → інструменти → … → відповідь з цитатами. Генерує події для SSE.

Історію клієнт надсилає стисло (текст реплік + джерела, без блоків міркувань і результатів
інструментів): прибрати всі thinking-блоки дозволено правилами preserved thinking, а клієнт
не може підкинути власні «результати інструментів». Усередині однієї відповіді повідомлення
лише дописуються (append-only), тож thinking-блоки між кроками лишаються дійсними.
"""

import json
import time
from collections.abc import Iterator
from typing import Any

import anthropic
import duckdb

from flame.agent import tools
from flame.agent.citations import Answer, build_answer, rewrite_request
from flame.agent.limits import cost_usd
from flame.agent.prompt import SYSTEM_PROMPT
from flame.agent.schemas import HistoryTurn
from flame.core.config import Settings

FALLBACK_BETA = "server-side-fallback-2026-07-01"
Event = dict[str, Any]


def _ev(name: str, **data: Any) -> Event:
    return {"event": name, "data": data}


def tool_definitions() -> list[dict[str, Any]]:
    defs = [{**t, "strict": True} if t["name"] in tools.STRICT else dict(t) for t in tools.TOOLS]
    defs[-1] = {**defs[-1], "cache_control": {"type": "ephemeral"}}  # кеш: system + tools
    return defs


def _user_text(turn: HistoryTurn) -> str:
    if turn.page_context:
        ctx = json.dumps(turn.page_context, ensure_ascii=False, sort_keys=True)
        return f"<page_context>\n{ctx}\n</page_context>\n\n{turn.text}"
    return turn.text


def build_messages(history: list[HistoryTurn]) -> list[dict[str, Any]]:
    """Стисла історія → messages. Детерміновано: однакова історія дає однаковий префікс кешу."""
    out: list[dict[str, Any]] = []
    for turn in history:
        if turn.role == "user":
            out.append({"role": "user", "content": _user_text(turn)})
        else:
            text = turn.text
            if turn.sources:
                listed = "; ".join(f"[{s.n}] {s.title} ({s.url})" for s in turn.sources)
                text += f"\n\nSources used: {listed}"
            out.append({"role": "assistant", "content": text})
    return out


def _run_tool(cur: duckdb.DuckDBPyConnection, block: Any) -> tuple[dict[str, Any], list[Event]]:
    """Виконує інструмент → (tool_result для моделі, SSE-події для UI)."""
    handler = tools.HANDLERS.get(block.name)
    result: dict[str, Any] = {"type": "tool_result", "tool_use_id": block.id}
    if handler is None or not isinstance(block.input, dict):
        bad = {**result, "is_error": True, "content": f"Unknown tool or bad input: {block.name}"}
        return bad, []
    try:
        out = handler(cur, block.input)
    except tools.ToolError as e:
        return {**result, "is_error": True, "content": f"Error: {e}"}, []
    return {**result, "content": out.content()}, out.events


def _answer_content(messages: list[dict[str, Any]], start: int) -> list[Any]:
    """Текстові блоки всіх відповідей асистента з `start`: модель може написати основну
    відповідь до виклику інструмента (напр. propose_action) і лише коротку фразу після нього."""
    out: list[Any] = []
    for m in messages[start:]:
        if m["role"] != "assistant" or isinstance(m["content"], str):
            continue
        texts = [b for b in m["content"] if getattr(b, "type", None) == "text"]
        if texts and out:
            out.append({"type": "text", "text": "\n\n"})
        out.extend(texts)
    return out


def run_turn(
    client: anthropic.Anthropic,
    cur: duckdb.DuckDBPyConnection,
    history: list[HistoryTurn],
    settings: Settings,
) -> Iterator[Event]:
    started = time.time()
    messages = build_messages(history)
    answer_from = len(messages)  # звідки збирати текст відповіді (після перезапиту — новий)
    usage_total = {"input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 0}
    cost = 0.0
    rewritten = False
    had_sources = False  # чи повертали інструменти цитовані джерела за цей хід
    answer: Answer | None = None
    stop_note: str | None = None

    for step in range(settings.agent_max_steps):
        last_step = step == settings.agent_max_steps - 1
        kwargs: dict[str, Any] = dict(
            model=settings.agent_model,
            max_tokens=settings.agent_max_tokens,
            system=[
                {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}
            ],
            tools=tool_definitions(),
            messages=messages,
            thinking={"type": "adaptive"},
            output_config={"effort": settings.agent_effort},
            cache_control={"type": "ephemeral"},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        )
        if last_step:  # ліміт кроків: змусити відповісти з уже зібраного
            kwargs["tool_choice"] = {"type": "none"}
        yield _ev("text_start")
        with client.beta.messages.stream(**kwargs) as stream:
            for event in stream:
                if event.type == "text":
                    yield _ev("text_delta", text=event.text)
            final = stream.get_final_message()

        step_cost = cost_usd(final.model or settings.agent_model, final.usage)
        cost += step_cost
        for k in usage_total:
            usage_total[k] += int(getattr(final.usage, k, 0) or 0)
        yield _ev("usage", cost_usd=round(step_cost, 5))
        messages.append({"role": "assistant", "content": final.content})

        if final.stop_reason == "refusal":
            stop_note = "refusal"
            yield _ev(
                "limit",
                reason="refusal",
                message="The model declined to answer this request. Try rephrasing it.",
            )
            break
        tool_uses = [b for b in final.content if b.type == "tool_use"]
        if final.stop_reason == "max_tokens":
            stop_note = "max_tokens"
            yield _ev(
                "limit",
                reason="max_tokens",
                message="The answer hit the length limit and may be cut off.",
            )
            if tool_uses:
                break
        if tool_uses and not last_step and final.stop_reason == "tool_use":
            results = []
            for block in tool_uses:
                args = block.input if isinstance(block.input, dict) else {}
                yield _ev("status", tool=block.name, text=tools.status_text(block.name, args))
                result, ui_events = _run_tool(cur, block)
                results.append(result)
                content = result.get("content")
                if isinstance(content, list) and any(
                    b.get("type") == "search_result" for b in content
                ):
                    had_sources = True
                for i, ev in enumerate(ui_events):
                    yield {**ev, "data": {**ev["data"], "id": f"{block.id}-{i}"}}
            messages.append({"role": "user", "content": results})
            continue

        answer = build_answer(_answer_content(messages, answer_from), history[-1].text)
        steps_left = settings.agent_max_steps - step - 1
        missing = answer.uncited_texts() or (had_sources and not answer.sources)
        if missing and not rewritten and steps_left > 0 and stop_note is None:
            rewritten = True
            yield _ev("rewrite", reason="uncited statements")
            messages.append({"role": "user", "content": rewrite_request(answer)})
            answer_from = len(messages)
            continue
        if last_step and settings.agent_max_steps > 1:
            stop_note = "max_steps"  # відповідь зібрана примусово, без нових інструментів
        break

    if stop_note == "max_steps" or (answer is None and stop_note is None):
        yield _ev(
            "limit",
            reason="max_steps",
            message=(
                f"The assistant stopped after {settings.agent_max_steps} steps; the answer is "
                "based on what it gathered so far."
            ),
        )
    if answer is None:
        answer = build_answer(_answer_content(messages, answer_from), history[-1].text)
    yield _ev(
        "done",
        answer=answer.model_dump(),
        usage=usage_total,
        cost_usd=round(cost, 5),
        rewritten=rewritten,
        duration_s=round(time.time() - started, 2),
    )
