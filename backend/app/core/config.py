"""
应用配置 — 环境变量驱动，分层环境管理
"""

import logging

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

DEV_SECRET_WARNING = "dev-secret-key-change-in-production"


class Settings(BaseSettings):
    """全局配置，优先级：环境变量 > .env > 默认值"""

    # 运行环境
    ENV: str = "development"  # development | staging | production

    # 数据库
    # 开发环境默认用 SQLite（无需 Docker），生产环境用 PostgreSQL+PostGIS
    # 切换方式：export DATABASE_URL="postgresql+asyncpg://poetry:xxx@localhost:5432/poetry_space"
    DATABASE_URL: str = "sqlite+aiosqlite:///./poetry_space_dev.db"

    # 搜索引擎
    # ELASTICSEARCH_URL: str = "http://localhost:9200"  # 预留

    # REDIS_URL: str = "redis://localhost:6379/0"  # 预留

    # JWT（预留，当前未启用认证）
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24小时

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:15173",  # PC Web (Vite dev)
    ]

    # 时空围栏 — 需求 4.1.4 固化参数
    GEO_FENCE_RADIUS_KM: int = 80
    TIME_TOLERANCE_YEARS: int = 1

    # 性能指标阈值
    MAP_RENDER_THRESHOLD_MS: int = 1000      # 地图千点位 ≤1s
    SEARCH_RESPONSE_THRESHOLD_MS: int = 500  # 检索 ≤500ms

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()

# 启动时检查：生产环境下禁止使用默认密钥
if settings.ENV in ("production", "staging") and settings.SECRET_KEY == DEV_SECRET_WARNING:
    logger.warning(
        "⚠️  SECRET_KEY 仍为默认值 '%s'！生产环境必须修改！\n"
        "    请通过环境变量或在 .env 中设置 SECRET_KEY=你的随机密钥",
        DEV_SECRET_WARNING,
    )
