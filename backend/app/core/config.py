from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = Field(default="development", alias="ENVIRONMENT")
    secret_key: str = Field(alias="SECRET_KEY")
    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")

    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ORIGINS",
    )
    access_token_expire_minutes: int = Field(
        default=60 * 24 * 7,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )

    default_avatar_url: str = Field(
        default="/static/avatars/default.png",
        alias="DEFAULT_AVATAR_URL",
    )
    jwt_cookie_name: str = Field(
        default="fastwatch_access_token", alias="JWT_COOKIE_NAME"
    )
    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")
    ws_session_ttl_seconds: int = Field(default=86400, alias="WS_SESSION_TTL_SECONDS")
    internal_api_key: str = Field(default="dev-internal-key", alias="INTERNAL_API_KEY")
    internal_api_url: str = Field(default="http://api:8000", alias="INTERNAL_API_URL")

    @property
    def cookie_secure_effective(self) -> bool:
        if self.cookie_secure:
            return True
        return not self.is_development

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        if not value.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use postgresql+asyncpg:// driver")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in {"development", "dev", "local"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
