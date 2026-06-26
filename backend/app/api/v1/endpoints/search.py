"""
多维检索服务 API — 六维度组合检索
需求 4.2：多维诗词聚合检索模块
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.search import SearchService

router = APIRouter()


@router.get("/poetry")
async def search_poetry(
    keyword: Optional[str] = Query(None, description="关键词（全文）"),
    author: Optional[str] = Query(None, description="作者名"),
    dynasty: Optional[str] = Query(None, description="朝代：唐/宋"),
    genre: Optional[str] = Query(None, description="体裁：五绝/七律/词/古风"),
    # 地理
    location: Optional[str] = Query(None, description="创作地点"),
    # 时间
    year_start: Optional[str] = Query(None, description="起始年份"),
    year_end: Optional[str] = Query(None, description="结束年份"),
    season: Optional[str] = Query(None, description="季节：春/夏/秋/冬"),
    festival: Optional[str] = Query(None, description="节日"),
    # 人物
    character: Optional[str] = Query(None, description="描写人物"),
    # 意象
    imagery: Optional[str] = Query(None, description="意象关键词"),
    # 意境
    mood_tag: Optional[str] = Query(None, description="意境：送别/边塞/田园/怀古"),
    # 用典
    allusion: Optional[str] = Query(None, description="典故名"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """六维度组合检索 — 自由交叉检索"""
    service = SearchService(db)
    return await service.search(
        keyword=keyword, author=author, dynasty=dynasty, genre=genre,
        location=location,
        year_start=year_start, year_end=year_end,
        season=season, festival=festival,
        character=character, imagery=imagery,
        mood_tag=mood_tag, allusion=allusion,
        page=page, page_size=page_size,
    )
