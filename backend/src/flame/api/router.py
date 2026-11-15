"""Головний роутер /api. Кожен модуль додає свій APIRouter тут."""

from fastapi import APIRouter

from flame.agent.router import router as agent_router
from flame.api.routes import health
from flame.media.router import router as media_router
from flame.media.router import studies_files_router
from flame.rag.router import router as rag_router
from flame.studies.flex.pages.router import router as flex_pages_router
from flame.studies.flex.router import router as flex_router
from flame.studies.psi.router import router as psi_studies_router
from flame.studies.router import router as studies_router
from flame.studies.saffire2.router import router as saffire2_router
from flame.studies.same_r.router import router as same_r_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(rag_router)
api_router.include_router(studies_router)
api_router.include_router(flex_router)
api_router.include_router(flex_pages_router)
api_router.include_router(same_r_router)  # перед psi: /studies/{slug} перехопив би same-r
api_router.include_router(saffire2_router)  # теж перед psi: сторінки Saffire-II
api_router.include_router(psi_studies_router)  # після FLEX: /studies/{slug} не для flex
api_router.include_router(media_router)
api_router.include_router(studies_files_router)
api_router.include_router(agent_router)
