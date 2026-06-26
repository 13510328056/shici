"""
时空查询服务 — PostGIS 空间查询 PoC
需求验证：80km 围栏查询、轨迹时间轴、交游概率计算
"""

import math
from typing import Optional

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


class SpatialQueryService:
    """空间查询服务 — 验证 PostGIS 时空查询性能"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.fence_radius_km = settings.GEO_FENCE_RADIUS_KM  # 80km
        self.time_tolerance = settings.TIME_TOLERANCE_YEARS   # ±1年

    async def find_places_within_radius(
        self, lon: float, lat: float, radius_km: Optional[int] = None
    ) -> list[dict]:
        """
        空间围栏查询：给定坐标 + 半径，查询范围内所有地名
        需求 4.1.4：80km 标准围栏

        PoC 目的：验证 PostGIS ST_DWithin 空间索引查询性能
        """
        radius = radius_km or self.fence_radius_km
        sql = text("""
            SELECT
                place_id,
                ancient_name,
                modern_name,
                province,
                city,
                ST_Distance(
                    geog::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) / 1000 AS distance_km
            FROM place_names
            WHERE ST_DWithin(
                geog::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius
            )
            ORDER BY distance_km
            LIMIT 200
        """)
        result = await self.db.execute(sql, {
            "lon": lon, "lat": lat, "radius": radius * 1000  # 转米
        })
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def get_poet_trajectory(
        self, poet_id: str, year_start: Optional[str] = None, year_end: Optional[str] = None
    ) -> list[dict]:
        """
        查询诗人轨迹事件（按时间轴）
        需求 4.1.2：三级时间轴控制 + 完整生命周期

        PoC 目的：验证时间 + 空间联合查询效率
        """
        conditions = ["poet_id = :poet_id"]
        params = {"poet_id": poet_id}

        if year_start:
            conditions.append("event_year >= :year_start")
            params["year_start"] = year_start
        if year_end:
            conditions.append("event_year <= :year_end")
            params["year_end"] = year_end

        where_clause = " AND ".join(conditions)
        sql = text(f"""
            SELECT
                id, event_year, event_date_precision,
                ancient_place, wgs84_lon, wgs84_lat,
                event_type, stay_duration_days, source
            FROM poet_trajectories
            WHERE {where_clause}
            ORDER BY event_year
        """)
        result = await self.db.execute(sql, params)
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def calculate_encounter_probability(
        self, poet_a_id: str, poet_b_id: str
    ) -> dict:
        """
        计算两位诗人在时空上的交游概率
        需求 4.1.4：标准化概率公式

        公式: P = (重叠时间 / (T₁+T₂-重叠时间)) × (重叠面积 / (A₁+A₂-重叠面积))

        PoC 目的：验证计算逻辑正确性与性能
        """
        # 1. 获取两位诗人的轨迹
        traj_a = await self.get_poet_trajectory(poet_a_id)
        traj_b = await self.get_poet_trajectory(poet_b_id)

        # 2. 计算时间重叠（简化实现 — 实际需处理 ±1年容错窗口）
        years_a = {t["event_year"] for t in traj_a}
        years_b = {t["event_year"] for t in traj_b}
        overlap_years = years_a & years_b

        if not overlap_years or not traj_a or not traj_b:
            return {"probability": 0, "overlap_years": [], "detail": "no overlap"}

        # 3. 空间重叠（简化 — 检查是否在同一围栏内）
        overlap_points = []
        for ya in traj_a:
            if ya["wgs84_lon"] is None or ya["wgs84_lat"] is None:
                continue
            for yb in traj_b:
                if yb["wgs84_lon"] is None or yb["wgs84_lat"] is None:
                    continue
                distance = self._haversine(
                    ya["wgs84_lon"], ya["wgs84_lat"],
                    yb["wgs84_lon"], yb["wgs84_lat"],
                )
                if distance <= self.fence_radius_km:
                    overlap_points.append({
                        "poet_a_event": ya["event_year"],
                        "poet_b_event": yb["event_year"],
                        "distance_km": round(distance, 2),
                    })

        # 4. 简化概率计算
        time_ratio = len(overlap_years) / max(len(years_a | years_b), 1)
        space_ratio = len(overlap_points) / max(len(traj_a) * len(traj_b), 1)
        probability = time_ratio * space_ratio

        return {
            "probability": round(min(probability, 1.0), 4),
            "overlap_years": sorted(overlap_years),
            "overlap_count": len(overlap_points),
            "total_events_a": len(traj_a),
            "total_events_b": len(traj_b),
        }

    def _haversine(self, lon1: float, lat1: float, lon2: float, lat2: float) -> float:
        """Haversine 公式计算两点间距离（km）"""
        R = 6371  # 地球半径
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (math.sin(d_lat / 2) ** 2
             + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
             * math.sin(d_lon / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    async def get_poetry_heatmap_data(
        self, dynasty: Optional[str] = None, mood_tag: Optional[str] = None
    ) -> list[dict]:
        """
        诗词热力分布数据
        需求 4.1.5：全局热力 + 主题筛选

        PoC 目的：验证聚合空间查询 + 多主题筛选
        """
        conditions = []
        params = {}

        if dynasty:
            conditions.append("p.dynasty = :dynasty")
            params["dynasty"] = dynasty
        if mood_tag:
            conditions.append(":mood_tag = ANY(pf.mood_tags)")
            params["mood_tag"] = mood_tag

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        sql = text(f"""
            SELECT
                pn.place_id,
                pn.ancient_name,
                pn.modern_name,
                pn.wgs84_lon,
                pn.wgs84_lat,
                pn.province,
                COUNT(p.poetry_id) AS poetry_count
            FROM poetry p
            JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
            JOIN place_names pn ON pn.place_id = pf.geo_creation_place_id
            {where_clause}
            GROUP BY pn.place_id, pn.ancient_name, pn.modern_name,
                     pn.wgs84_lon, pn.wgs84_lat, pn.province
            ORDER BY poetry_count DESC
            LIMIT 500
        """)
        result = await self.db.execute(sql, params)
        rows = result.mappings().all()
        return [dict(row) for row in rows]
