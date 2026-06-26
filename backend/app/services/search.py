"""
多维检索服务 — 六维度组合检索
需求 4.2：聚合检索模块
"""

from typing import Optional

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.compat import supports_geography


class SearchService:
    """六维度诗词检索服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._pg = supports_geography()

    async def search(
        self,
        keyword: Optional[str] = None,
        author: Optional[str] = None,
        dynasty: Optional[str] = None,
        genre: Optional[str] = None,
        # 地理
        location: Optional[str] = None,
        # 时间
        year_start: Optional[str] = None,
        year_end: Optional[str] = None,
        season: Optional[str] = None,
        festival: Optional[str] = None,
        # 人物
        character: Optional[str] = None,
        # 意象
        imagery: Optional[str] = None,
        # 意境
        mood_tag: Optional[str] = None,
        # 用典
        allusion: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """六维度组合检索"""
        conditions = []
        params = {}

        # 关键词（全文）
        if keyword:
            if self._pg:
                conditions.append("p.content ILIKE :kw")
            else:
                conditions.append("p.content LIKE :kw")
            params["kw"] = f"%{keyword}%"

        # 作者
        if author:
            conditions.append("po.name LIKE :author")
            params["author"] = f"%{author}%"

        # 朝代
        if dynasty:
            conditions.append("p.dynasty = :dynasty")
            params["dynasty"] = dynasty

        # 体裁
        if genre:
            conditions.append("p.genre = :genre")
            params["genre"] = genre

        # 地理
        if location:
            if self._pg:
                conditions.append("(pn.ancient_name ILIKE :loc OR pn.modern_name ILIKE :loc)")
            else:
                conditions.append("(pn.ancient_name LIKE :loc OR pn.modern_name LIKE :loc)")
            params["loc"] = f"%{location}%"

        # 季节
        if season:
            if self._pg:
                conditions.append(":season = ANY(pf.season)")
            else:
                conditions.append("pf.season LIKE :season")
            params["season"] = f"%{season}%" if not self._pg else season

        # 节日
        if festival:
            if self._pg:
                conditions.append(":fest = ANY(pf.festival)")
            else:
                conditions.append("pf.festival LIKE :fest")
            params["fest"] = f"%{festival}%" if not self._pg else festival

        # 时间范围
        if year_start:
            conditions.append("pf.creation_year >= :ys")
            params["ys"] = year_start
        if year_end:
            conditions.append("pf.creation_year <= :ye")
            params["ye"] = year_end

        # 人物
        if character:
            if self._pg:
                conditions.append(":char = ANY(pf.character_names)")
            else:
                conditions.append("pf.character_names LIKE :char")
            params["char"] = f"%{character}%" if not self._pg else character

        # 意象
        if imagery:
            if self._pg:
                conditions.append(":img = ANY(pf.imagery_items)")
            else:
                conditions.append("pf.imagery_items LIKE :img")
            params["img"] = f"%{imagery}%" if not self._pg else imagery

        # 意境
        if mood_tag:
            if self._pg:
                conditions.append(":mood = ANY(pf.mood_tags)")
            else:
                conditions.append("pf.mood_tags LIKE :mood")
            params["mood"] = f"%{mood_tag}%" if not self._pg else mood_tag

        # 用典
        if allusion:
            if self._pg:
                conditions.append(":allu = ANY(pf.allusion_names)")
            else:
                conditions.append("pf.allusion_names LIKE :allu")
            params["allu"] = f"%{allusion}%" if not self._pg else allusion

        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        # 总数
        count_sql = text(f"""
            SELECT COUNT(*) FROM poetry p
            JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
            JOIN poets po ON po.poet_id = p.author_id
            LEFT JOIN place_names pn ON pn.place_id = pf.geo_creation_place_id
            {where}
        """)
        total = (await self.db.execute(count_sql, params)).scalar() or 0

        # 分页查询
        offset = (page - 1) * page_size
        data_sql = text(f"""
            SELECT p.poetry_id, p.title, p.content, p.genre, p.dynasty,
                   po.name AS author,
                   pf.creation_year, pf.season, pf.festival,
                   pf.character_names, pf.imagery_items, pf.mood_tags,
                   pf.allusion_names, pn.ancient_name AS place_name
            FROM poetry p
            JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
            JOIN poets po ON po.poet_id = p.author_id
            LEFT JOIN place_names pn ON pn.place_id = pf.geo_creation_place_id
            {where}
            ORDER BY p.created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        params["limit"] = page_size
        params["offset"] = offset
        result = await self.db.execute(data_sql, params)
        rows = result.mappings().all()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "results": [
                {
                    "poetry_id": str(r["poetry_id"]),
                    "title": r["title"],
                    "content": r["content"],
                    "genre": r["genre"],
                    "dynasty": r["dynasty"],
                    "author": r["author"],
                    "creation_year": r["creation_year"],
                    "season": self._parse_json_array(r["season"]),
                    "mood_tags": self._parse_json_array(r["mood_tags"]),
                    "imagery_items": self._parse_json_array(r["imagery_items"]),
                    "place_name": r["place_name"],
                }
                for r in rows
            ],
        }

    def _parse_json_array(self, val):
        """解析可能为 JSON 字符串的数组字段"""
        if val is None:
            return []
        if isinstance(val, list):
            return val
        if isinstance(val, str):
            import json
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                return [val] if val else []
        return []
