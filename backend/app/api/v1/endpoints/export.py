"""
数据导出服务 API — 需求 4.1.6
"""

from typing import Optional, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.export import ExportService

router = APIRouter()


def _make_download_response(content: bytes, filename: str, format: str) -> Response:
    if format == "excel":
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif format == "shp":
        media_type = "application/zip"
    else:
        media_type = "text/csv; charset=utf-8"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/places")
async def export_places(
    format: Literal["csv", "excel", "shp"] = Query("csv", description="导出格式: csv/excel/shp"),
    db: AsyncSession = Depends(get_db),
):
    """导出古今地名表"""
    s = ExportService(db)
    if format == "excel":
        data = await s.export_places_excel()
        filename = "places.xlsx"
    elif format == "shp":
        data = await s.export_places_shapefile()
        filename = "places.zip"
    else:
        data = await s.export_places_csv()
        filename = "places.csv"
    return _make_download_response(data, filename, format)


@router.get("/poets")
async def export_poets(
    format: Literal["csv", "excel"] = Query("csv", description="导出格式: csv/excel"),
    db: AsyncSession = Depends(get_db),
):
    """导出诗人列表"""
    s = ExportService(db)
    if format == "excel":
        data = await s.export_poets_excel()
        filename = "poets.xlsx"
    else:
        data = await s.export_poets_csv()
        filename = "poets.csv"
    return _make_download_response(data, filename, format)


@router.get("/trajectories")
async def export_trajectories(
    poet_id: Optional[str] = Query(None, description="指定诗人ID，不传则导出全部"),
    format: Literal["csv", "excel", "shp"] = Query("csv", description="导出格式: csv/excel/shp"),
    db: AsyncSession = Depends(get_db),
):
    """导出轨迹数据"""
    s = ExportService(db)
    if format == "excel":
        data = await s.export_trajectories_excel(poet_id)
        filename = "trajectories.xlsx"
    elif format == "shp":
        data = await s.export_trajectories_shapefile(poet_id)
        filename = "trajectories.zip"
    else:
        data = await s.export_trajectories_csv(poet_id)
        filename = "trajectories.csv"
    return _make_download_response(data, filename, format)


@router.get("/poetry")
async def export_poetry(
    format: Literal["csv", "excel"] = Query("csv", description="导出格式: csv/excel"),
    db: AsyncSession = Depends(get_db),
):
    """导出诗词数据"""
    s = ExportService(db)
    if format == "excel":
        data = await s.export_poetry_excel()
        filename = "poetry.xlsx"
    else:
        data = await s.export_poetry_csv()
        filename = "poetry.csv"
    return _make_download_response(data, filename, format)


@router.get("/encounters")
async def export_encounters(
    format: Literal["csv", "excel"] = Query("csv", description="导出格式: csv/excel"),
    db: AsyncSession = Depends(get_db),
):
    """导出交游概率数据"""
    s = ExportService(db)
    if format == "excel":
        data = await s.export_encounters_excel()
        filename = "encounters.xlsx"
    else:
        data = await s.export_encounters_csv()
        filename = "encounters.csv"
    return _make_download_response(data, filename, format)


@router.get("/stats")
async def export_stats(db: AsyncSession = Depends(get_db)):
    """导出统计数据 (JSON)"""
    s = ExportService(db)
    return await s.export_stats_json()
