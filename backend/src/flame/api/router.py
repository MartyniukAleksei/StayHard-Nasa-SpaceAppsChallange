"""Головний роутер /api. Кожен модуль додає свій APIRouter тут."""

from fastapi import APIRouter

from flame.api.routes import health

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
# TODO: studies.flex.router (/api/studies/flex/...), media.router (/api/media/...),
#       agent.router (/api/agent, streaming)
