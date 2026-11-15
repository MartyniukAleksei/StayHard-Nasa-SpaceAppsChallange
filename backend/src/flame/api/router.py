"""Головний роутер /api. Кожен модуль додає свій APIRouter тут."""

from fastapi import APIRouter

from flame.api.routes import health
from flame.rag.router import router as rag_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(rag_router)
# TODO: studies.flex.router (/api/studies/flex/...), media.router (/api/media/...),
#       agent.router (/api/agent, streaming)
