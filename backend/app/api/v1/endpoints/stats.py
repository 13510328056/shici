"""
统计分析 API — 需求对应 SRS 第 3 章
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.stats import StatsService

router = APIRouter()


@router.get("")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """获取全量诗词统计分析数据"""
    svc = StatsService(db)
    return await svc.get_all_stats()
