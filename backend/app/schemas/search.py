"""
多维检索 — 请求/响应 Schema
需求 4.2：六维度组合检索
"""

from typing import Optional
from pydantic import BaseModel, Field


class PoetrySearchRequest(BaseModel):
    """六维度组合检索请求"""
    # 地理
    location_lon: Optional[float] = Field(None, description="中心经度")
    location_lat: Optional[float] = Field(None, description="中心纬度")
    location_radius_km: Optional[int] = Field(80, description="地理围栏半径")

    # 时间
    year_start: Optional[str] = Field(None, description="起始年份")
    year_end: Optional[str] = Field(None, description="结束年份")
    season: Optional[str] = Field(None, description="四季：春/夏/秋/冬")
    solar_term: Optional[str] = Field(None, description="二十四节气")
    festival: Optional[str] = Field(None, description="传统节日")

    # 人物
    character: Optional[str] = Field(None, description="描写人物")

    # 意象
    imagery: Optional[str] = Field(None, description="物品意象关键词")

    # 意境
    mood_tag: Optional[str] = Field(None, description="意境标签")

    # 用典
    allusion: Optional[str] = Field(None, description="典故名称")

    # 分页
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PoetryResult(BaseModel):
    """单条检索结果"""
    poetry_id: str
    title: str
    author: str
    dynasty: str
    content: str
    genre: Optional[str] = None
    mood_tags: list[str] = []
    match_score: float = 0.0


class PoetrySearchResponse(BaseModel):
    """检索响应"""
    total: int
    results: list[PoetryResult] = []
    suggestion: Optional[str] = None
