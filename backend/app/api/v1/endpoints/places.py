"""
地名映射服务 API — 古今地名查询 / 坐标转换 / 围栏检索
需求依据：3.2.1 古今地名映射数据库
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.spatial import SpatialQueryService

router = APIRouter()


@router.get("/search")
async def search_places(
    q: str = Query(..., description="古地名或现代地名关键词"),
    dynasty: Optional[str] = Query(None, description="朝代过滤"),
    db: AsyncSession = Depends(get_db),
):
    """古今地名模糊查询 — 按古名或现名检索"""
    # TODO: 对接 ES 或数据库模糊查询
    # 当前为 PoC 桩
    return {"query": q, "dynasty": dynasty, "results": []}


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
    # TODO: 从 place_name_changes 表查询
    return {"place_id": place_id, "changes": []}
