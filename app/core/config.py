from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    APP_NAME: str = "Async CMS API"
    DEBUG: bool = True
    SECRET_KEY: str = "change-this-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    DATABASE_URL: str = "mysql+aiomysql://cms_user:cms_password@localhost:3306/cms_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    RATE_LIMIT_PER_MINUTE: int = 60


settings = Settings()
