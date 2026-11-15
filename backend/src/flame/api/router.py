"""Головний роутер /api. Кожен модуль додає свій APIRouter тут."""

from fastapi import APIRouter

from flame.api.routes import health
from flame.media import router as media
from flame.studies import router as studies
from flame.studies.flex import router as flex

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(studies.router)
api_router.include_router(flex.router)
api_router.include_router(media.router)
# TODO: agent.router (/api/agent, streaming)
