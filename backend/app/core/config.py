from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# .../backend/app/core/config.py -> parents[2] = .../backend
BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

class Settings(BaseSettings):
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    SESSION_SECRET: str = "change_this_later"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()

# Metric names to exclude from WSM calculations and rankings
DISABLED_METRICS: set[str] = {"Operating Cash Flow"}
