"""
数据库初始化脚本 — 创建所有表
用法: python scripts/init_db.py
"""

import asyncio
import sys
from pathlib import Path

# 添加 backend 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import engine, Base
from app.models import *  # noqa: F401, F403 — 注册所有模型


async def init():
    print(f"[init_db] 创建数据库表...")
    print(f"[init_db] 数据库: {engine.url}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print(f"[init_db] ✅ 完成")


if __name__ == "__main__":
    asyncio.run(init())
