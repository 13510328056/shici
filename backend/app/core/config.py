"""
应用配置 — 环境变量驱动，分层环境管理
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """全局配置，优先级：环境变量 > .env > 默认值"""

    # 运行环境
    ENV: str = "development"  # development | staging | production

    # 数据库
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/poetry_space"
    )

    # 搜索引擎
    ELASTICSEARCH_URL: str = "http://localhost:9200"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24小时

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",   # PC Web
        "http://localhost:5173",   # Vite dev
    ]

    # 时空围栏 — 需求 4.1.4 固化参数
    GEO_FENCE_RADIUS_KM: int = 80
    TIME_TOLERANCE_YEARS: int = 1

    # 性能指标阈值
    MAP_RENDER_THRESHOLD_MS: int = 1000      # 地图千点位 ≤1s
    SEARCH_RESPONSE_THRESHOLD_MS: int = 500  # 检索 ≤500ms

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
