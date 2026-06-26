"""
数据导出服务 — 需求 4.1.6
格式支持：CSV / Excel / GIS shp
"""

import csv, io, json
from typing import Optional
from datetime import datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.place_name import PlaceName
from app.models.poet import Poet, PoetTrajectory, PoetEncounter
from app.models.poetry import Poetry, PoetryFeature


class ExportService:
    """数据导出服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def export_places_csv(self) -> bytes:
        """导出古今地名映射表为CSV"""
        rows = (await self.db.execute(select(PlaceName).order_by(PlaceName.ancient_name))).scalars().all()
        output = io.StringIO()
        w = csv.writer(output)
        w.writerow(['古地名', '现代地名', '经度', '纬度', '省', '市', '区县', '行政级别', '数据来源'])
        for p in rows:
            w.writerow([p.ancient_name, p.modern_name, p.wgs84_lon, p.wgs84_lat,
                       p.province or '', p.city or '', p.district or '', p.admin_level or '', p.source or ''])
        return output.getvalue().encode('utf-8-sig')

    async def export_poets_csv(self) -> bytes:
        """导出诗人列表为CSV"""
        rows = (await self.db.execute(select(Poet).order_by(Poet.dynasty, Poet.name))).scalars().all()
        output = io.StringIO()
        w = csv.writer(output)
        w.writerow(['姓名', '朝代', '出生年', '卒年', '身份标签'])
        for p in rows:
            w.writerow([p.name, p.dynasty, p.birth_year or '', p.death_year or '',
                       ','.join(p.tags) if p.tags else ''])
        return output.getvalue().encode('utf-8-sig')

    async def export_trajectories_csv(self, poet_id: Optional[str] = None) -> bytes:
        """导出轨迹数据为CSV"""
        from sqlalchemy import text as sqltext
        if poet_id:
            sql = sqltext("""
                SELECT po.name AS poet_name, t.event_year, t.ancient_place,
                       t.wgs84_lon, t.wgs84_lat, t.event_type, t.stay_duration_days
                FROM poet_trajectories t JOIN poets po ON po.poet_id = t.poet_id
                WHERE t.poet_id = :pid ORDER BY t.event_year
            """)
            rows = (await self.db.execute(sql, {"pid": poet_id})).mappings().all()
        else:
            sql = sqltext("""
                SELECT po.name AS poet_name, t.event_year, t.ancient_place,
                       t.wgs84_lon, t.wgs84_lat, t.event_type, t.stay_duration_days
                FROM poet_trajectories t JOIN poets po ON po.poet_id = t.poet_id
                ORDER BY po.name, t.event_year
            """)
            rows = (await self.db.execute(sql)).mappings().all()

        output = io.StringIO()
        w = csv.writer(output)
        w.writerow(['诗人', '年份', '地点', '经度', '纬度', '事件类型', '停留天数'])
        for r in rows:
            w.writerow([r['poet_name'], r['event_year'], r['ancient_place'] or '',
                       r['wgs84_lon'] or '', r['wgs84_lat'] or '',
                       r['event_type'], r['stay_duration_days'] or ''])
        return output.getvalue().encode('utf-8-sig')

    async def export_poetry_csv(self) -> bytes:
        """导出诗词数据为CSV"""
        sql = text("""
            SELECT po.name AS author, p.title, p.content, p.genre, p.dynasty,
                   pf.creation_year, pf.mood_tags, pf.imagery_items, pf.season,
                   pf.festival, pf.allusion_names, pf.character_names
            FROM poetry p
            JOIN poets po ON po.poet_id = p.author_id
            LEFT JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
            ORDER BY po.name, p.title
        """)
        rows = (await self.db.execute(sql)).mappings().all()

        output = io.StringIO()
        w = csv.writer(output)
        w.writerow(['作者', '标题', '内容', '体裁', '朝代', '创作年份',
                    '意境', '意象', '季节', '节日', '用典', '人物'])
        for r in rows:
            w.writerow([
                r['author'], r['title'], r['content'], r['genre'] or '', r['dynasty'],
                r['creation_year'] or '',
                self._fmt_list(r['mood_tags']),
                self._fmt_list(r['imagery_items']),
                self._fmt_list(r['season']),
                self._fmt_list(r['festival']),
                self._fmt_list(r['allusion_names']),
                self._fmt_list(r['character_names']),
            ])
        return output.getvalue().encode('utf-8-sig')

    async def export_encounters_csv(self) -> bytes:
        """导出交游概率数据为CSV"""
        sql = text("""
            SELECT pa.name AS poet_a, pb.name AS poet_b,
                   e.overlap_start_year, e.overlap_end_year,
                   e.encounter_probability, e.period_overlap_days
            FROM poet_encounters e
            JOIN poets pa ON pa.poet_id = e.poet_a_id
            JOIN poets pb ON pb.poet_id = e.poet_b_id
            ORDER BY e.encounter_probability DESC
        """)
        rows = (await self.db.execute(sql)).mappings().all()

        output = io.StringIO()
        w = csv.writer(output)
        w.writerow(['诗人A', '诗人B', '重叠起始年', '重叠结束年', '交游概率', '重叠天数'])
        for r in rows:
            w.writerow([r['poet_a'], r['poet_b'],
                       r['overlap_start_year'] or '', r['overlap_end_year'] or '',
                       r['encounter_probability'] or 0, r['period_overlap_days'] or ''])
        return output.getvalue().encode('utf-8-sig')

    async def export_stats_json(self) -> dict:
        """导出统计数据（JSON格式，用于学术引用）"""
        poet_count = (await self.db.execute(select(Poet))).scalars().all().__len__()
        place_count = (await self.db.execute(select(PlaceName))).scalars().all().__len__()
        poetry_count = (await self.db.execute(select(Poetry))).scalars().all().__len__()
        traj_count = (await self.db.execute(select(PoetTrajectory))).scalars().all().__len__()

        # 朝代分布
        dynasty_sql = text("SELECT dynasty, COUNT(*) as cnt FROM poets GROUP BY dynasty ORDER BY cnt DESC")
        dynasty_dist = [dict(r) for r in (await self.db.execute(dynasty_sql)).mappings().all()]

        return {
            'export_time': datetime.utcnow().isoformat(),
            'data_summary': {
                'poets': poet_count,
                'places': place_count,
                'poetry': poetry_count,
                'trajectories': traj_count,
            },
            'dynasty_distribution': dynasty_dist,
        }

    def _fmt_list(self, val) -> str:
        """格式化数组字段为逗号分隔字符串"""
        if val is None:
            return ''
        if isinstance(val, list):
            return '; '.join(val)
        if isinstance(val, str):
            import json
            try:
                items = json.loads(val)
                return '; '.join(items) if isinstance(items, list) else val
            except: pass
            return val
        return ''
