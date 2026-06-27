"""
PoetrySpace — Alembic 迁移环境配置
支持异步引擎 + SQLite/PostgreSQL 双模式
"""
import asyncio
import re
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import settings
from app.core.database import Base

# 引入所有模型以确保 Base.metadata 完整
from app.models.place_name import PlaceName, PlaceNameChange, PlaceAmbiguityRule  # noqa
from app.models.poet import Poet, PoetTrajectory, PoetEncounter  # noqa
from app.models.poetry import Poetry, PoetryFeature  # noqa

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 从 settings 获取数据库 URL（支持 SQLite / PostgreSQL）
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """离线迁移：仅生成 SQL 脚本，不连接数据库"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """在线迁移：连接数据库执行迁移"""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.DATABASE_URL

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        do_run_migrations(connection)
    await connectable.dispose()


def run_migrations_online() -> None:
    """运行在线迁移"""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
