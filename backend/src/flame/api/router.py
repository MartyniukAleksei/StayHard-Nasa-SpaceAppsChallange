"""Головний роутер /api. Кожен модуль додає свій APIRouter тут."""

from fastapi import APIRouter

from flame.agent.router import router as agent_router
from flame.api.routes import health
from flame.media.router import router as media_router
from flame.rag.router import router as rag_router
from flame.studies.flex.router import router as flex_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(rag_router)
api_router.include_router(flex_router)
api_router.include_router(media_router)
api_router.include_router(agent_router)
