"""Головний роутер /api. Кожен модуль додає свій APIRouter тут."""

from fastapi import APIRouter

from flame.agent.router import router as agent_router
from flame.api.routes import health
from flame.media.router import router as media_router
from flame.rag.router import router as rag_router
from flame.studies.bass2.router import media_router as bass2_media_router
from flame.studies.bass2.router import router as bass2_router
from flame.studies.flex.pages.router import router as flex_pages_router
from flame.studies.flex.router import router as flex_router
from flame.studies.router import router as studies_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(rag_router)
api_router.include_router(studies_router)
api_router.include_router(flex_router)
api_router.include_router(flex_pages_router)
api_router.include_router(media_router)
api_router.include_router(bass2_router)
api_router.include_router(bass2_media_router)
api_router.include_router(agent_router)
