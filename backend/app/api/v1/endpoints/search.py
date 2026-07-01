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


@router.get("/all")
async def search_all(
    keyword: Optional[str] = Query(None, description="统一关键词"),
    dynasty: Optional[str] = Query(None, description="朝代筛选"),
    genre: Optional[str] = Query(None, description="体裁筛选"),
    mood_tag: Optional[str] = Query(None, description="意境筛选"),
    season: Optional[str] = Query(None, description="季节筛选"),
    imagery: Optional[str] = Query(None, description="意象筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """统一搜索：同时搜索诗人 + 诗词（支持组合筛选）"""
    results = {"poets": [], "poems": [], "total": 0}

    s = SearchService(db)

    # 诗人检索（keyword 或 dynasty 任意一个即可触发）
    if keyword or dynasty:
        results["poets"] = await s.search_poets(keyword=keyword, dynasty=dynasty)

    # 诗词检索
    poem_data = await s.search(
        keyword=keyword,
        dynasty=dynasty,
        genre=genre,
        mood_tag=mood_tag,
        season=season,
        imagery=imagery,
        page=page,
        page_size=page_size,
    )
    results["poems"] = poem_data.get("results", [])
    results["total"] = poem_data.get("total", 0)

    return results


@router.get("/poets")
async def search_poets(
    keyword: Optional[str] = Query(None, description="诗人名称关键词"),
    dynasty: Optional[str] = Query(None, description="朝代筛选"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """单独检索诗人"""
    s = SearchService(db)
    poets = await s.search_poets(keyword=keyword, dynasty=dynasty, limit=limit)
    return {"poets": poets}
