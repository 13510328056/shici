"""
多维检索服务 — 六维度组合检索（ORM 实现）
需求 4.2：聚合检索模块

使用 SQLAlchemy ORM 替代裸 SQL，通过 compat 层自动处理
PostgreSQL/SQLite 数组字段差异，消除重复的分支判断。
"""

from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.poetry import Poetry, PoetryFeature
from app.models.poet import Poet
from app.models.place_name import PlaceName


class SearchService:
    """六维度诗词检索服务 — ORM 实现"""

    def __init__(self, db: AsyncSession):
        self.db = db
        try:
            b = db.get_bind()
            self._sqlite = str(b.url).startswith("sqlite") if hasattr(b, 'url') else (b.dialect.name == "sqlite")
        except Exception:
            self._sqlite = True

    async def search(
        self,
        keyword: Optional[str] = None,
        author: Optional[str] = None,
        dynasty: Optional[str] = None,
        genre: Optional[str] = None,
        location: Optional[str] = None,
        year_start: Optional[str] = None,
        year_end: Optional[str] = None,
        season: Optional[str] = None,
        festival: Optional[str] = None,
        character: Optional[str] = None,
        imagery: Optional[str] = None,
        mood_tag: Optional[str] = None,
        allusion: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """六维度组合检索 — ORM 查询"""
        # 基础查询（使用 joinedload 避免 N+1 懒加载）
        query = (
            select(Poetry)
            .join(PoetryFeature, PoetryFeature.poetry_id == Poetry.poetry_id)
            .join(Poet, Poet.poet_id == Poetry.author_id)
            .outerjoin(PlaceName, PlaceName.place_id == PoetryFeature.geo_creation_place_id)
            .options(joinedload(Poetry.features), joinedload(Poetry.author))
        )

        conditions = []

        # 关键词（全文检索 content + title）
        if keyword:
            chars = [c for c in keyword if '一' <= c <= '鿿']
            if chars:
                # 整体匹配 + 单字 OR 匹配
                word_conditions = [Poetry.content.ilike(f"%{keyword}%")]
                if len(chars) >= 2:
                    word_conditions.extend(
                        Poetry.content.ilike(f"%{ch}%") for ch in chars
                    )
                conditions.append(or_(*word_conditions))
            else:
                conditions.append(Poetry.content.ilike(f"%{keyword}%"))

        # 作者
        if author:
            query = query.where(Poet.name.ilike(f"%{author}%"))

        # 朝代
        if dynasty:
            conditions.append(Poetry.dynasty == dynasty)

        # 体裁
        if genre:
            conditions.append(Poetry.genre == genre)

        # 创作地点
        if location:
            conditions.append(
                or_(
                    PlaceName.ancient_name.ilike(f"%{location}%"),
                    PlaceName.modern_name.ilike(f"%{location}%"),
                )
            )

        # 季节（数组字段，靠 compat 层自动适配）
        if season:
            if self._sqlite:
                conditions.append(PoetryFeature.season.like(f"%{season}%"))
            else:
                conditions.append(PoetryFeature.season.any(season))

        # 节日
        if festival:
            if self._sqlite:
                conditions.append(PoetryFeature.festival.like(f"%{festival}%"))
            else:
                conditions.append(PoetryFeature.festival.any(festival))

        # 时间范围
        if year_start:
            conditions.append(PoetryFeature.creation_year >= year_start)
        if year_end:
            conditions.append(PoetryFeature.creation_year <= year_end)

        # 人物
        if character:
            if self._sqlite:
                conditions.append(PoetryFeature.character_names.like(f"%{character}%"))
            else:
                conditions.append(PoetryFeature.character_names.any(character))

        # 意象
        if imagery:
            if self._sqlite:
                conditions.append(PoetryFeature.imagery_items.like(f"%{imagery}%"))
            else:
                conditions.append(PoetryFeature.imagery_items.any(imagery))

        # 意境
        if mood_tag:
            if self._sqlite:
                conditions.append(PoetryFeature.mood_tags.like(f'%{mood_tag}%'))
            else:
                conditions.append(PoetryFeature.mood_tags.any(mood_tag))

        # 用典
        if allusion:
            if self._sqlite:
                conditions.append(PoetryFeature.allusion_names.like(f'%{allusion}%'))
            else:
                conditions.append(PoetryFeature.allusion_names.any(allusion))

        # 应用所有条件
        for cond in conditions:
            query = query.where(cond)

        # 统计总数
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0

        # 分页
        offset = (page - 1) * page_size
        query = query.order_by(Poetry.created_at.desc()).offset(offset).limit(page_size)

        # 执行查询
        result = await self.db.execute(query)
        rows = result.unique().scalars().all()

        # 转换结果（含创作地坐标）
        results = []
        for poem in rows:
            feat = poem.features
            lat = lng = None
            place_name = ""
            if feat and feat.geo_creation_place_id:
                pn = (await self.db.execute(
                    select(PlaceName).where(PlaceName.place_id == feat.geo_creation_place_id)
                )).scalar_one_or_none()
                if pn:
                    lat, lng, place_name = pn.wgs84_lat, pn.wgs84_lon, pn.ancient_name
            results.append({
                "poetry_id": str(poem.poetry_id),
                "title": poem.title,
                "content": poem.content,
                "genre": poem.genre or "",
                "dynasty": poem.dynasty,
                "author": poem.author.name if poem.author else "",
                "creation_year": feat.creation_year if feat else None,
                "season": feat.season if feat else [],
                "mood_tags": feat.mood_tags if feat else [],
                "imagery_items": feat.imagery_items if feat else [],
                "place_name": place_name,
                "wgs84_lat": lat,
                "wgs84_lon": lng,
            })

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "results": results,
        }
