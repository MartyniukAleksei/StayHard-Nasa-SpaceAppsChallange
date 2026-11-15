"""Налаштування з env (і `.env`). Усі шляхи до даних — тільки звідси."""

from functools import cached_property
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# <repo>/data — локальний дефолт; у Docker/Railway DATA_DIR=/data (Volume).
_REPO_DATA = Path(__file__).resolve().parents[4] / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "local"
    data_dir: Path = _REPO_DATA
    db_path: Path | None = None  # за замовчуванням <data_dir>/build/flame.duckdb
    cors_origins: list[str] = ["http://localhost:5173"]
    # zip зі знімком FLEX (містить flex/…); якщо задано і data_dir порожній — качається при старті
    data_archive_url: str | None = None
    # кеш моделей ембеддингів (fastembed); у Docker-образі модель запечена в /app/models
    models_dir: Path | None = None

    @cached_property
    def flex_dir(self) -> Path:
        """Джерельний знімок FLEX (read-only), який збирає flame.ingest.psi_flex."""
        return self.data_dir / "flex"

    @cached_property
    def duckdb_path(self) -> Path:
        """Зібрана БД застосунку (flame.ingest.build_db)."""
        return self.db_path or self.data_dir / "build" / "flame.duckdb"

    @cached_property
    def embed_cache_dir(self) -> Path:
        """Куди fastembed кладе/звідки читає ONNX-модель RAG."""
        return self.models_dir or self.data_dir / "models"


settings = Settings()
