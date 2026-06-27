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
async def list_poets(
    limit: Optional[int] = Query(None, description="返回条数上限"),
    offset: Optional[int] = Query(0, ge=0, description="分页偏移"),
    dynasty: Optional[str] = Query(None, description="朝代过滤"),
    db: AsyncSession = Depends(get_db),
):
    """获取诗人列表（支持分页、朝代过滤）"""
    from app.models.poet import Poet
    from sqlalchemy import select, func

    # 总数
    count_q = select(func.count()).select_from(Poet)
    if dynasty:
        count_q = count_q.where(Poet.dynasty == dynasty)
    total = (await db.execute(count_q)).scalar() or 0

    # 查询
    q = select(Poet).order_by(Poet.dynasty, Poet.name)
    if dynasty:
        q = q.where(Poet.dynasty == dynasty)
    if limit:
        q = q.limit(limit).offset(offset)

    result = await db.execute(q)
    poets = result.scalars().all()
    return {
        "poets": [
            {"poet_id": str(p.poet_id), "name": p.name, "dynasty": p.dynasty}
            for p in poets
        ],
        "total": total,
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
    year_start: Optional[str] = Query(None, description="起始年份"),
    year_end: Optional[str] = Query(None, description="结束年份"),
    db: AsyncSession = Depends(get_db),
):
    """诗词热力分布数据 — 支持时间范围过滤 需求 4.1.5"""
    service = SpatialQueryService(db)
    data = await service.get_poetry_heatmap_data(dynasty, mood, year_start, year_end)
    return {"count": len(data), "points": data}


@router.get("/{poet_id}/poetry")
async def get_poet_poetry(
    poet_id: str,
    limit: Optional[int] = Query(None, description="返回条数上限，不传则返回全部"),
    offset: Optional[int] = Query(0, ge=0, description="分页偏移"),
    db: AsyncSession = Depends(get_db),
):
    """获取某位诗人的作品（支持分页，使用 JOIN 消除 N+1）"""
    from app.models.poetry import Poetry, PoetryFeature
    from sqlalchemy import select, func as sa_func
    from sqlalchemy.orm import joinedload

    # 总数（一次 count 查询）
    total = (await db.execute(
        select(sa_func.count()).select_from(Poetry).where(Poetry.author_id == poet_id)
    )).scalar() or 0

    # 分页查询 + JOIN PoetryFeature（一次查询消除 N+1）
    stmt = (
        select(Poetry)
        .where(Poetry.author_id == poet_id)
        .options(joinedload(Poetry.features))
        .order_by(Poetry.title)
        .offset(offset)
    )
    if limit:
        stmt = stmt.limit(limit)

    poems = (await db.execute(stmt)).unique().scalars().all()

    results = []
    for poem in poems:
        feat = poem.features
        results.append({
            "poetry_id": str(poem.poetry_id),
            "title": poem.title,
            "content": poem.content,
            "genre": poem.genre or '',
            "dynasty": poem.dynasty,
            "mood_tags": feat.mood_tags if feat else [],
            "imagery_items": feat.imagery_items if feat else [],
        })

    return {"poems": results, "count": len(results), "total": total}
