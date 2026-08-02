from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from OCR_* environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="OCR_",
        extra="ignore",
    )

    service_name: str = "vimawallah-ocr"
    host: str = "0.0.0.0"
    port: int = Field(default=8001, ge=1, le=65535)
    log_level: str = "INFO"

    max_upload_bytes: int = Field(default=15 * 1024 * 1024, ge=1)
    max_image_pixels: int = Field(default=40_000_000, ge=1_000_000)
    preprocessing_max_side: int = Field(default=2600, ge=640, le=8000)
    request_timeout_seconds: float = Field(default=90.0, gt=0, le=600)
    upload_chunk_bytes: int = Field(default=1024 * 1024, ge=64 * 1024)

    min_field_confidence: float = Field(default=0.55, ge=0, le=1)
    cpu_threads: int = Field(default=2, ge=1, le=32)
    model_cache_dir: Path = Path("/models")
    enable_document_orientation: bool = True
    text_detection_model_name: str = "PP-OCRv5_mobile_det"
    text_recognition_model_name: str = "PP-OCRv5_mobile_rec"

    cors_allowed_origins: str = ""
    cors_allow_credentials: bool = False

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]

    @model_validator(mode="after")
    def validate_cors(self) -> "Settings":
        if self.cors_allow_credentials and "*" in self.allowed_origins:
            raise ValueError("wildcard CORS is not allowed when credentials are enabled")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
