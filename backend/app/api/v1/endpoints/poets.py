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


@router.get("")
async def list_poets(db: AsyncSession = Depends(get_db)):
    """获取所有诗人列表"""
    from app.models.poet import Poet
    from sqlalchemy import select
    result = await db.execute(select(Poet).order_by(Poet.dynasty, Poet.name))
    poets = result.scalars().all()
    return {
        "poets": [
            {"poet_id": str(p.poet_id), "name": p.name, "dynasty": p.dynasty}
            for p in poets
        ]
    }


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


@router.get("/{poet_id}/poetry")
async def get_poet_poetry(
    poet_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取某位诗人的全部作品"""
    from app.models.poetry import Poetry, PoetryFeature
    from sqlalchemy import select as q

    stmt = q(Poetry).where(Poetry.author_id == poet_id).order_by(Poetry.title)
    poems = (await db.execute(stmt)).scalars().all()

    results = []
    for poem in poems:
        feat = (await db.execute(
            q(PoetryFeature).where(PoetryFeature.poetry_id == poem.poetry_id)
        )).scalar_one_or_none()

        results.append({
            "poetry_id": str(poem.poetry_id),
            "title": poem.title,
            "content": poem.content,
            "genre": poem.genre or '',
            "dynasty": poem.dynasty,
            "mood_tags": feat.mood_tags if feat else [],
            "imagery_items": feat.imagery_items if feat else [],
        })

    return {"poems": results, "count": len(results)}
