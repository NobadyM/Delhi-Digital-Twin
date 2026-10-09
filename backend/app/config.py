from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    APP_NAME: str = "Delhi Digital Twin API"
    APP_VERSION: str = "2.1.0"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False

    # Server configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8001

    # Database configuration (SQLite by default, supports PostgreSQL via DATABASE_URL)
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'delhi_digital_twin.db'}"

    # External APIs
    OPEN_METEO_URL: str = "https://air-quality-api.open-meteo.com/v1/air-quality"
    REQUEST_TIMEOUT_SECONDS: int = 25

    # Background Ingestion & Freshness
    INGESTION_INTERVAL_SECONDS: int = 300  # Run every 5 minutes
    STALE_THRESHOLD_MINUTES: int = 120     # Flag as STALE if >2 hours without update
    DELAYED_THRESHOLD_MINUTES: int = 30    # Flag as DELAYED if >30 min behind schedule

    # AI Model configuration
    MODEL_PATH: Path = BASE_DIR / "model" / "isolation_forest.pkl"
    MODEL_VERSION: str = "isolation_forest_v1.0"
    FORECAST_MODEL_VERSION: str = "trend_ar_v1.0"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ]

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
