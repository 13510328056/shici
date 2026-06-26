"""
诗人轨迹 API — 行迹动态可视化 / 交游概率 / 热力分析
需求依据：4.1 诗词时空可视化综合模块
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.spatial import SpatialQueryService

router = APIRouter()


@router.get("/{poet_id}/trajectory")
async def get_trajectory(
    poet_id: str,
    year_start: Optional[str] = Query(None, description="起始年份"),
    year_end: Optional[str] = Query(None, description="结束年份"),
    db: AsyncSession = Depends(get_db),
):
    """诗人行迹轨迹（支持时间轴过滤）— 需求 4.1.2"""
    service = SpatialQueryService(db)
    trajectory = await service.get_poet_trajectory(poet_id, year_start, year_end)
    return {
        "poet_id": poet_id,
        "year_range": {"start": year_start, "end": year_end},
        "events": trajectory,
    }


@router.post("/encounter")
async def calculate_encounter(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """文人交游概率计算 — 需求 4.1.4"""
    poet_a = body.get("poet_a_id")
    poet_b = body.get("poet_b_id")
    if not poet_a or not poet_b:
        return {"error": "需要提供 poet_a_id 和 poet_b_id"}

    service = SpatialQueryService(db)
    result = await service.calculate_encounter_probability(poet_a, poet_b)
    return result


@router.get("/heatmap")
async def get_heatmap(
    dynasty: Optional[str] = Query(None, description="朝代过滤"),
    mood: Optional[str] = Query(None, description="意境标签过滤"),
    db: AsyncSession = Depends(get_db),
):
    """诗词热力分布数据 — 需求 4.1.5"""
    service = SpatialQueryService(db)
    data = await service.get_poetry_heatmap_data(dynasty, mood)
    return {"count": len(data), "points": data}
