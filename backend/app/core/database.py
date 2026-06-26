"""
数据库引擎与会话管理
支持双模式：SQLite（开发） / PostgreSQL+PostGIS（生产）
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event as sa_event

from app.core.config import settings


def _get_engine_kwargs():
    """根据数据库类型返回引擎参数"""
    url = settings.DATABASE_URL
    kwargs = {"echo": settings.ENV == "development"}

    if url.startswith("sqlite"):
        # SQLite 开发模式 — 单线程限制放宽
        kwargs["connect_args"] = {"check_same_thread": False}
        kwargs["poolclass"] = None  # SQLite 不需要连接池
    else:
        # PostgreSQL 生产模式
        kwargs["pool_size"] = 10
        kwargs["max_overflow"] = 20

    return kwargs


engine = create_async_engine(
    settings.DATABASE_URL,
    **_get_engine_kwargs(),
)

# SQLite 启用 WAL 模式 + 外键约束（开发环境）
if settings.DATABASE_URL.startswith("sqlite"):

    @sa_event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA cache_size=-8000")  # 8MB cache
        cursor.close()

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """SQLAlchemy ORM 基类"""
    pass


async def get_db() -> AsyncSession:
    """FastAPI 依赖注入 — 获取数据库会话"""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def is_postgres() -> bool:
    """当前是否使用 PostgreSQL（含 PostGIS）"""
    return settings.DATABASE_URL.startswith("postgresql")
