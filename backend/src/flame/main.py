from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from flame.api.router import api_router
from flame.core.config import settings


def create_app() -> FastAPI:
    app = FastAPI(title="Flame in Freefall API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    return app


app = create_app()
