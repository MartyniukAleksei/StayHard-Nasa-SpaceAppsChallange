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

    # Агент (flame.agent). Ключ — лише в env / .env, ніколи в коді.
    anthropic_api_key: str | None = None
    agent_model: str = "claude-sonnet-5-5"
    agent_effort: str = "medium"  # low | medium | high — глибина міркувань і витрати
    agent_max_steps: int = 8  # кроків «модель → інструменти» на одну відповідь
    agent_max_tokens: int = 8000  # вихідних токенів на один крок
    agent_history_turns: int = 10  # скільки останніх реплік історії приймаємо
    agent_max_message_chars: int = 2000
    agent_rate_per_minute: int = 5  # запитів з одного IP
    agent_rate_per_day: int = 50
    agent_budget_usd: float = 10.0  # стеля витрат процесу; жорсткий ліміт — в Anthropic Console

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
