"""POST /api/agent — відповідь агента потоком Server-Sent Events.

Події: text_start, text_delta, status, usage, rewrite, limit, error, done (див. docs/agent/).
"""

import json
import logging
from collections.abc import Iterator
from functools import lru_cache
from typing import NoReturn

import anthropic
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from flame.agent import loop
from flame.agent.limits import Budget, RateLimiter
from flame.agent.schemas import AgentRequest
from flame.core.config import settings
from flame.db.duckdb import get_connection

router = APIRouter(prefix="/agent", tags=["agent"])
log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def rate_limiter() -> RateLimiter:
    return RateLimiter(settings.agent_rate_per_minute, settings.agent_rate_per_day)


@lru_cache(maxsize=1)
def budget() -> Budget:
    return Budget(settings.agent_budget_usd)


@lru_cache(maxsize=1)
def client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key, max_retries=2)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")  # Railway проксі
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


def _deny(status: int, reason: str, message: str, retry_after: int | None = None) -> NoReturn:
    headers = {"Retry-After": str(retry_after)} if retry_after else None
    detail = {"reason": reason, "message": message, "retry_after": retry_after}
    raise HTTPException(status, detail, headers=headers)


def _sse(event: dict) -> str:
    return f"event: {event['event']}\ndata: {json.dumps(event['data'], ensure_ascii=False)}\n\n"


@router.post("")
def ask(req: AgentRequest, request: Request) -> StreamingResponse:
    if not settings.anthropic_api_key:
        _deny(503, "not_configured", "The assistant is not configured on this server yet.")
    if budget().exhausted:
        _deny(503, "budget", "The assistant has used its spending budget. Try again later.")
    history = req.messages[-settings.agent_history_turns :]
    while history and history[0].role != "user":  # обрізана історія починається з питання
        history = history[1:]
    if not history or history[-1].role != "user":
        _deny(422, "bad_history", "The last message must be a user question.")
    if len(history[-1].text) > settings.agent_max_message_chars:
        _deny(
            422,
            "too_long",
            f"Questions are limited to {settings.agent_max_message_chars} characters.",
        )
    wait = rate_limiter().check(_client_ip(request))
    if wait is not None:
        _deny(429, "rate_limit", f"Too many questions. Try again in {wait} s.", retry_after=wait)

    def stream() -> Iterator[str]:
        cur = get_connection().cursor()  # власний курсор: генератор живе довше за залежності
        try:
            for event in loop.run_turn(client(), cur, history, settings):
                if event["event"] == "usage":
                    budget().add(event["data"]["cost_usd"])
                yield _sse(event)
        except anthropic.RateLimitError:
            yield _sse(
                {
                    "event": "error",
                    "data": {"reason": "model_busy", "message": "The model is busy. Try again."},
                }
            )
        except anthropic.APIError as e:
            msg = "The assistant could not reach the model. Try again shortly."
            log.error("agent API error: %s", e)
            yield _sse({"event": "error", "data": {"reason": "api_error", "message": msg}})
        finally:
            cur.close()

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
