"""
数据导出服务 API — 需求 4.1.6
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.export import ExportService

router = APIRouter()


@router.get("/places")
async def export_places(db: AsyncSession = Depends(get_db)):
    """导出古今地名表 (CSV)"""
    s = ExportService(db)
    data = await s.export_places_csv()
    return Response(content=data, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=places.csv"})


@router.get("/poets")
async def export_poets(db: AsyncSession = Depends(get_db)):
    """导出诗人列表 (CSV)"""
    s = ExportService(db)
    data = await s.export_poets_csv()
    return Response(content=data, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=poets.csv"})


@router.get("/trajectories")
async def export_trajectories(
    poet_id: Optional[str] = Query(None, description="指定诗人ID，不传则导出全部"),
    db: AsyncSession = Depends(get_db),
):
    """导出轨迹数据 (CSV)"""
    s = ExportService(db)
    data = await s.export_trajectories_csv(poet_id)
    return Response(content=data, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=trajectories.csv"})


@router.get("/poetry")
async def export_poetry(db: AsyncSession = Depends(get_db)):
    """导出诗词数据 (CSV)"""
    s = ExportService(db)
    data = await s.export_poetry_csv()
    return Response(content=data, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=poetry.csv"})


@router.get("/encounters")
async def export_encounters(db: AsyncSession = Depends(get_db)):
    """导出交游概率数据 (CSV)"""
    s = ExportService(db)
    data = await s.export_encounters_csv()
    return Response(content=data, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=encounters.csv"})


@router.get("/stats")
async def export_stats(db: AsyncSession = Depends(get_db)):
    """导出统计数据 (JSON)"""
    s = ExportService(db)
    data = await s.export_stats_json()
    return data
