"""
地名映射服务 API — 古今地名查询 / 坐标转换 / 围栏检索 / 地名沿革
需求依据：3.2.1 古今地名映射数据库
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.spatial import SpatialQueryService
from app.models.place_name import PlaceName, PlaceNameChange

router = APIRouter()


@router.get("/search")
async def search_places(
    q: str = Query(..., description="古地名或现代地名关键词"),
    dynasty: Optional[str] = Query(None, description="朝代过滤"),
    limit: Optional[int] = Query(20, description="返回条数上限"),
    db: AsyncSession = Depends(get_db),
):
    """古今地名模糊查询 — 按古名或现名检索"""
    stmt = select(PlaceName).where(
        or_(
            PlaceName.ancient_name.ilike(f"%{q}%"),
            PlaceName.modern_name.ilike(f"%{q}%"),
        )
    ).limit(limit)
    result = await db.execute(stmt)
    places = result.scalars().all()
    return {
        "query": q,
        "dynasty": dynasty,
        "count": len(places),
        "results": [
            {
                "place_id": str(p.place_id),
                "ancient_name": p.ancient_name,
                "modern_name": p.modern_name,
                "province": p.province,
                "city": p.city,
                "district": p.district,
                "wgs84_lon": p.wgs84_lon,
                "wgs84_lat": p.wgs84_lat,
                "admin_level": p.admin_level,
            }
            for p in places
        ],
    }


@router.get("/fence")
async def fence_query(
    lon: float = Query(..., description="中心经度 (WGS84)"),
    lat: float = Query(..., description="中心纬度 (WGS84)"),
    radius: Optional[int] = Query(None, description="围栏半径 (km)，默认80km"),
    db: AsyncSession = Depends(get_db),
):
    """空间围栏查询 — 80km 半径内所有地名"""
    service = SpatialQueryService(db)
    results = await service.find_places_within_radius(lon, lat, radius)
    return {
        "center": {"lon": lon, "lat": lat},
        "radius_km": radius or 80,
        "count": len(results),
        "places": results,
    }


@router.get("/{place_id}/timeline")
async def place_timeline(
    place_id: str,
    db: AsyncSession = Depends(get_db),
):
    """地名沿革时间线 — 古今名称变更历史"""
    stmt = (
        select(PlaceNameChange)
        .where(PlaceNameChange.place_id == place_id)
        .order_by(PlaceNameChange.change_year)
    )
    result = await db.execute(stmt)
    changes = result.scalars().all()
    return {
        "place_id": place_id,
        "count": len(changes),
        "changes": [
            {
                "id": str(c.id),
                "change_year": c.change_year,
                "old_name": c.old_name,
                "new_name": c.new_name,
                "source": c.source,
            }
            for c in changes
        ],
    }
