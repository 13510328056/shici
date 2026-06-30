"""
诗人轨迹 API — 行迹动态可视化 / 交游概率 / 热力分析
需求依据：4.1 诗词时空可视化综合模块
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.spatial import SpatialQueryService

router = APIRouter()


@router.get("/{poet_id}/detail")
async def get_poet_detail(poet_id: str, db: AsyncSession = Depends(get_db)):
    """获取诗人详细信息（按 ID）"""
    from app.models.poet import Poet
    result = await db.execute(select(Poet).where(Poet.poet_id == poet_id))
    poet = result.scalar_one_or_none()
    if not poet:
        return {"error": "poet not found"}

    import json
    return {
        "poet_id": str(poet.poet_id),
        "name": poet.name,
        "dynasty": poet.dynasty,
        "birth_year": poet.birth_year or "",
        "death_year": poet.death_year or "",
        "tags": json.loads(poet.tags) if isinstance(poet.tags, str) else (poet.tags or []),
        "description": poet.description or "",
    }


@router.get("")
async def list_poets(
    limit: Optional[int] = Query(None, description="返回条数上限"),
    offset: Optional[int] = Query(0, ge=0, description="分页偏移"),
    dynasty: Optional[str] = Query(None, description="朝代过滤"),
    name: Optional[str] = Query(None, description="诗人名称精确匹配"),
    db: AsyncSession = Depends(get_db),
):
    """获取诗人列表（支持分页、朝代过滤、名称精确匹配）"""
    from app.models.poet import Poet
    import json
    from sqlalchemy import select, func

    # 总数
    count_q = select(func.count()).select_from(Poet)
    if dynasty:
        count_q = count_q.where(Poet.dynasty == dynasty)
    if name:
        count_q = count_q.where(Poet.name == name)
    total = (await db.execute(count_q)).scalar() or 0

    # 查询
    q = select(Poet).order_by(Poet.dynasty, Poet.name)
    if dynasty:
        q = q.where(Poet.dynasty == dynasty)
    if name:
        q = q.where(Poet.name == name)
    if limit:
        q = q.limit(limit).offset(offset)

    result = await db.execute(q)
    poets = result.scalars().all()
    return {
        "poets": [
            {"poet_id": str(p.poet_id), "name": p.name, "dynasty": p.dynasty, "tags": (json.loads(p.tags) if isinstance(p.tags, str) and p.tags else (p.tags if isinstance(p.tags, list) else [])), "description": (p.description or "")[:200] if p.description else ""}
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


@router.get("/stats")
async def get_poet_stats(
    poet_id: Optional[str] = Query(None, description="诗人ID，不传则返回全局统计"),
    db: AsyncSession = Depends(get_db),
):
    """诗人统计数据 — 游历城市 / 作品分布 / 事件时长"""
    from app.models.poet import Poet, PoetTrajectory
    from app.models.poetry import Poetry, PoetryFeature
    from app.models.place_name import PlaceName
    import json
    from sqlalchemy import select, func, text

    if poet_id:
        # 单诗人统计
        # 游历城市
        city_sql = text("""
            SELECT COUNT(DISTINCT t.ancient_place) FROM poet_trajectories t
            WHERE t.poet_id = :pid AND t.ancient_place IS NOT NULL
        """)
        city_count = (await db.execute(city_sql, {"pid": poet_id})).scalar() or 0

        # 各城市作品数
        poems_sql = text("""
            SELECT pn.ancient_name, COUNT(*) as cnt
            FROM poetry p
            JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
            JOIN place_names pn ON pn.place_id = pf.geo_creation_place_id
            WHERE p.author_id = :pid
            GROUP BY pn.place_id ORDER BY cnt DESC LIMIT 10
        """)
        poems_by_city = [{"city": r[0], "count": r[1]} for r in (await db.execute(poems_sql, {"pid": poet_id})).all()]

        # 各事件类型时长
        dur_sql = text("""
            SELECT event_type, SUM(stay_duration_days) as total_days, COUNT(*) as events
            FROM poet_trajectories WHERE poet_id = :pid AND stay_duration_days IS NOT NULL
            GROUP BY event_type ORDER BY total_days DESC
        """)
        duration_by_type = [{"type": r[0], "days": r[1], "events": r[2]} for r in (await db.execute(dur_sql, {"pid": poet_id})).all()]

        # 总作品数
        total_poems = (await db.execute(
            select(func.count()).select_from(Poetry).where(Poetry.author_id == poet_id)
        )).scalar() or 0

        return {
            "poet_id": poet_id,
            "total_cities": city_count,
            "total_poems": total_poems,
            "poems_by_city": poems_by_city,
            "duration_by_type": duration_by_type,
        }
    else:
        # 全局统计
        r = await db.execute(
            select(Poet.dynasty, func.count()).group_by(Poet.dynasty).order_by(func.count().desc())
        )
        dynasty_dist = [{"dynasty": d, "count": c} for d, c in r.all()]
        return {"dynasty_distribution": dynasty_dist}


@router.get("/{poet_id}/poetry")
async def get_poet_poetry(
    poet_id: str,
    limit: Optional[int] = Query(None, description="返回条数上限，不传则返回全部"),
    offset: Optional[int] = Query(0, ge=0, description="分页偏移"),
    db: AsyncSession = Depends(get_db),
):
    """获取某位诗人的作品（支持分页，使用 JOIN 消除 N+1）"""
    from app.models.poetry import Poetry, PoetryFeature
    import json
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
