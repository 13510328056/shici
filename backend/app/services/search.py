"""
多维检索服务 — 六维度组合检索（ORM 实现）
需求 4.2：聚合检索模块

使用 SQLAlchemy ORM 替代裸 SQL，通过 compat 层自动处理
PostgreSQL/SQLite 数组字段差异，消除重复的分支判断。
"""

from typing import Optional

from sqlalchemy import select, func, or_, and_, case, cast, String as SAType
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.poetry import Poetry, PoetryFeature
from app.models.poet import Poet
from app.models.place_name import PlaceName


# ─── 相关性权重 ─────────────────────────────────────────

SCORE_TITLE   = 100  # 标题匹配
SCORE_AUTHOR  = 80   # 作者名匹配
SCORE_CONTENT = 60   # 正文匹配
SCORE_MOOD    = 40   # 意境/季节/节日匹配
SCORE_IMAGERY = 30   # 意象/人物匹配


class SearchService:
    """六维度诗词检索服务 — ORM 实现"""

    def __init__(self, db: AsyncSession):
        self.db = db
        try:
            b = db.get_bind()
            self._sqlite = str(b.url).startswith("sqlite") if hasattr(b, 'url') else (b.dialect.name == "sqlite")
        except Exception:
            self._sqlite = True

    # ── 主检索 ─────────────────────────────────────────

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
        # 无任何条件 → 提前返回空
        if not any([keyword, author, dynasty, genre, location,
                    year_start, year_end, season, festival,
                    character, imagery, mood_tag, allusion]):
            return {"total": 0, "page": page, "page_size": page_size, "results": []}

        # 基础查询（使用 joinedload 避免 N+1 懒加载）
        query = (
            select(Poetry)
            .join(PoetryFeature, PoetryFeature.poetry_id == Poetry.poetry_id)
            .join(Poet, Poet.poet_id == Poetry.author_id)
            .outerjoin(PlaceName, PlaceName.place_id == PoetryFeature.geo_creation_place_id)
            .options(joinedload(Poetry.features), joinedload(Poetry.author))
        )

        conditions = []

        # ── 关键词：多字段 OR 匹配（删除单字拆分） ──
        if keyword:
            kw_conditions = [
                Poetry.title.ilike(f"%{keyword}%"),
                Poet.name.ilike(f"%{keyword}%"),
                Poetry.content.ilike(f"%{keyword}%"),
            ]
            # 数组字段（通过 compat 层自动适配）
            for field, val in [
                (PoetryFeature.mood_tags, keyword),
                (PoetryFeature.imagery_items, keyword),
                (PoetryFeature.season, keyword),
                (PoetryFeature.festival, keyword),
            ]:
                if self._sqlite:
                    kw_conditions.append(cast(field, SAType).like(f"%{val}%"))
                else:
                    kw_conditions.append(field.any(val))
            conditions.append(or_(*kw_conditions))

        # 作者名（显式筛选，与 keyword 中匹配作者名不同）
        if author:
            conditions.append(Poet.name.ilike(f"%{author}%"))

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

        # 季节
        if season:
            if self._sqlite:
                conditions.append(cast(PoetryFeature.season, SAType).like(f"%{season}%"))
            else:
                conditions.append(PoetryFeature.season.any(season))

        # 节日
        if festival:
            if self._sqlite:
                conditions.append(cast(PoetryFeature.festival, SAType).like(f"%{festival}%"))
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
                conditions.append(cast(PoetryFeature.character_names, SAType).like(f"%{character}%"))
            else:
                conditions.append(PoetryFeature.character_names.any(character))

        # 意象
        if imagery:
            if self._sqlite:
                conditions.append(cast(PoetryFeature.imagery_items, SAType).like(f"%{imagery}%"))
            else:
                conditions.append(PoetryFeature.imagery_items.any(imagery))

        # 意境
        if mood_tag:
            if self._sqlite:
                conditions.append(cast(PoetryFeature.mood_tags, SAType).like(f'%{mood_tag}%'))
            else:
                conditions.append(PoetryFeature.mood_tags.any(mood_tag))

        # 用典
        if allusion:
            if self._sqlite:
                conditions.append(cast(PoetryFeature.allusion_names, SAType).like(f'%{allusion}%'))
            else:
                conditions.append(PoetryFeature.allusion_names.any(allusion))

        # 应用所有条件
        for cond in conditions:
            query = query.where(cond)

        # 统计总数
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0

        # ── 排序：相关性 → 创建时间 ──
        if keyword:
            score_parts = [
                case((Poetry.title.ilike(f"%{keyword}%"), SCORE_TITLE), else_=0),
                case((Poet.name.ilike(f"%{keyword}%"), SCORE_AUTHOR), else_=0),
                case((Poetry.content.ilike(f"%{keyword}%"), SCORE_CONTENT), else_=0),
            ]
            for field, score in [
                (PoetryFeature.mood_tags, SCORE_MOOD),
                (PoetryFeature.imagery_items, SCORE_IMAGERY),
                (PoetryFeature.season, SCORE_MOOD),
                (PoetryFeature.festival, SCORE_MOOD),
            ]:
                if self._sqlite:
                    score_parts.append(case((cast(field, SAType).like(f"%{keyword}%"), score), else_=0))
                else:
                    score_parts.append(case((field.any(keyword), score), else_=0))
            score_expr = sum(score_parts)
            query = query.order_by(score_expr.desc(), Poetry.created_at.desc())
        else:
            query = query.order_by(Poetry.created_at.desc())

        # 分页
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        # 执行查询
        result = await self.db.execute(query)
        rows = result.unique().scalars().all()

        # 转换结果（含创作地坐标 + 相关性）
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

            entry = {
                "poetry_id": str(poem.poetry_id),
                "title": poem.title,
                "content": poem.content,
                "genre": poem.genre or "",
                "dynasty": poem.dynasty,
                "author": poem.author.name if poem.author else "",
                "author_id": str(poem.author_id) if poem.author_id else "",
                "creation_year": feat.creation_year if feat else None,
                "season": feat.season if feat else [],
                "mood_tags": feat.mood_tags if feat else [],
                "imagery_items": feat.imagery_items if feat else [],
                "place_name": place_name,
                "wgs84_lat": lat,
                "wgs84_lon": lng,
                "relevance": self._compute_relevance(poem, keyword) if keyword else {"score": 0, "reasons": []},
            }
            results.append(entry)

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "results": results,
        }

    # ── 相关性计算（Python 后处理） ─────────────────

    def _compute_relevance(self, poem: Poetry, keyword: str) -> dict:
        """计算单条结果的关键词匹配原因"""
        if not keyword:
            return {"score": 0, "reasons": []}

        reasons = []
        author_name = poem.author.name if poem.author else ""

        if keyword in (poem.title or ""):
            reasons.append({"field": "title", "label": "标题匹配"})
        if keyword in author_name:
            reasons.append({"field": "author", "label": "作者匹配"})
        if keyword in (poem.content or ""):
            reasons.append({"field": "content", "label": "内容匹配"})

        feat = poem.features
        if feat:
            if feat.mood_tags and any(keyword in (t or "") for t in feat.mood_tags):
                reasons.append({"field": "mood", "label": "意境匹配"})
            if feat.imagery_items and any(keyword in (t or "") for t in feat.imagery_items):
                reasons.append({"field": "imagery", "label": "意象匹配"})
            if feat.season and any(keyword in (t or "") for t in feat.season):
                reasons.append({"field": "season", "label": "季节匹配"})
            if feat.festival and any(keyword in (t or "") for t in feat.festival):
                reasons.append({"field": "festival", "label": "节日匹配"})
            if feat.character_names and any(keyword in (t or "") for t in feat.character_names):
                reasons.append({"field": "character", "label": "人物匹配"})

        score = sum(
            {"title": 100, "author": 80, "content": 60,
             "mood": 40, "season": 40, "festival": 40,
             "imagery": 30, "character": 30}
            .get(r["field"], 0)
            for r in reasons
        )
        return {"score": score, "reasons": reasons}

    # ── 作者检索 ─────────────────────────────────────

    async def search_poets(
        self,
        keyword: Optional[str] = None,
        dynasty: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict]:
        """检索诗人列表（按名称 + 朝代筛选）"""
        query = select(Poet)
        conditions = []
        if keyword:
            conditions.append(Poet.name.ilike(f"%{keyword}%"))
        if dynasty:
            conditions.append(Poet.dynasty == dynasty)
        for cond in conditions:
            query = query.where(cond)
        query = query.order_by(Poet.name).limit(limit)
        rows = (await self.db.execute(query)).scalars().all()
        return [
            {"poet_id": str(p.poet_id), "name": p.name, "dynasty": p.dynasty,
             "tags": p.tags or []}
            for p in rows
        ]
