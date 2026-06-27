"""
数据导出服务 — 需求 4.1.6
格式支持：CSV / Excel / GIS shp
"""

import csv, io, json, os, tempfile, zipfile
from datetime import datetime
from typing import Optional

from openpyxl import Workbook
import shapefile
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.place_name import PlaceName, PlaceNameChange
from app.models.poet import Poet, PoetTrajectory, PoetEncounter
from app.models.poetry import Poetry, PoetryFeature


class ExportService:
    """数据导出服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _workbook_to_bytes(self, workbook: Workbook) -> bytes:
        output = io.BytesIO()
        workbook.save(output)
        output.seek(0)
        return output.getvalue()

    def _write_excel(self, headers: list[str], rows: list[list[object]], sheet_name: str = "Data") -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = sheet_name[:31]
        ws.append(headers)
        for row in rows:
            ws.append([item if item is not None else "" for item in row])
        return self._workbook_to_bytes(wb)

    def _write_prj_file(self, prj_path: str) -> None:
        with open(prj_path, "w", encoding="utf-8") as prj:
            prj.write(
                'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],'
                'PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]'
            )

    def _write_shapefile(self, base_name: str, fields: list[tuple[str, str, int]], records: list[dict]) -> bytes:
        with tempfile.TemporaryDirectory() as tmpdir:
            shp_base = os.path.join(tmpdir, base_name)
            writer = shapefile.Writer(shp_base, shapeType=shapefile.POINT)
            writer.autoBalance = 1
            for name, fld_type, size in fields:
                writer.field(name, fld_type, size=size)
            for rec in records:
                writer.point(rec["lon"], rec["lat"])
                writer.record(*rec["values"])
            writer.close()
            self._write_prj_file(shp_base + ".prj")

            output = io.BytesIO()
            with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                for suffix in [".shp", ".shx", ".dbf", ".prj"]:
                    path = shp_base + suffix
                    if os.path.exists(path):
                        zf.write(path, os.path.basename(path))
            output.seek(0)
            return output.getvalue()

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

    async def export_poets_excel(self) -> bytes:
        """导出诗人列表为Excel"""
        rows = (await self.db.execute(select(Poet).order_by(Poet.dynasty, Poet.name))).scalars().all()
        data = [[p.name, p.dynasty, p.birth_year or '', p.death_year or '', ','.join(p.tags) if p.tags else ''] for p in rows]
        return self._write_excel(['姓名', '朝代', '出生年', '卒年', '身份标签'], data, sheet_name='Poets')

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

    async def export_poetry_excel(self) -> bytes:
        """导出诗词数据为Excel"""
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
        data = [
            [
                r['author'], r['title'], r['content'], r['genre'] or '', r['dynasty'],
                r['creation_year'] or '',
                self._fmt_list(r['mood_tags']),
                self._fmt_list(r['imagery_items']),
                self._fmt_list(r['season']),
                self._fmt_list(r['festival']),
                self._fmt_list(r['allusion_names']),
                self._fmt_list(r['character_names']),
            ]
            for r in rows
        ]
        return self._write_excel(
            ['作者', '标题', '内容', '体裁', '朝代', '创作年份', '意境', '意象', '季节', '节日', '用典', '人物'],
            data,
            sheet_name='Poetry',
        )

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

    async def export_encounters_excel(self) -> bytes:
        """导出交游概率数据为Excel"""
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
        data = [[
            r['poet_a'], r['poet_b'], r['overlap_start_year'] or '', r['overlap_end_year'] or '',
            r['encounter_probability'] or 0, r['period_overlap_days'] or '',
        ] for r in rows]
        return self._write_excel(
            ['诗人A', '诗人B', '重叠起始年', '重叠结束年', '交游概率', '重叠天数'],
            data,
            sheet_name='Encounters',
        )

    async def export_stats_json(self) -> dict:
        """导出统计数据（JSON格式，匹配前端 StatsData 接口）"""
        # 各实体计数
        models = {
            "poets": Poet, "places": PlaceName, "poetry": Poetry,
            "trajectories": PoetTrajectory, "features": PoetryFeature,
            "encounters": PoetEncounter, "name_changes": PlaceNameChange,
        }
        counts = {}
        for name, model in models.items():
            cnt = (await self.db.execute(select(func.count()).select_from(model))).scalar()
            counts[name] = cnt

        # 朝代分布 → flat dict
        dynasties = {}
        r = await self.db.execute(
            select(Poet.dynasty, func.count()).group_by(Poet.dynasty).order_by(func.count().desc())
        )
        for dynasty, cnt in r:
            dynasties[dynasty] = cnt

        # 体裁分布
        genres = {}
        r = await self.db.execute(
            select(Poetry.genre, func.count()).group_by(Poetry.genre).order_by(func.count().desc())
        )
        for genre, cnt in r:
            if genre:
                genres[genre] = cnt

        # 创作地 TOP 20
        top_places = []
        r = await self.db.execute(text("""
            SELECT pn.ancient_name, COUNT(*) as cnt
            FROM poetry_features pf
            JOIN place_names pn ON pn.place_id = pf.geo_creation_place_id
            GROUP BY pf.geo_creation_place_id
            ORDER BY cnt DESC LIMIT 20
        """))
        for row in r:
            top_places.append({"place": row[0], "count": row[1]})

        # 时间线：按创作年份统计（前50年）
        timeline = []
        r = await self.db.execute(text("""
            SELECT pf.creation_year, COUNT(*) as cnt
            FROM poetry_features pf
            WHERE pf.creation_year IS NOT NULL AND pf.creation_year != ''
            GROUP BY pf.creation_year ORDER BY pf.creation_year LIMIT 50
        """))
        for row in r:
            timeline.append({"year": row[0], "count": row[1]})

        return {
            "counts": counts,
            "dynasties": dynasties,
            "genres": genres,
            "top_places": top_places,
            "timeline": timeline,
        }

    async def export_places_excel(self) -> bytes:
        """导出古今地名映射表为Excel"""
        rows = (await self.db.execute(select(PlaceName).order_by(PlaceName.ancient_name))).scalars().all()
        data = [[
            p.ancient_name, p.modern_name, p.wgs84_lon, p.wgs84_lat,
            p.province or '', p.city or '', p.district or '', p.admin_level or '', p.source or '',
        ] for p in rows]
        return self._write_excel(
            ['古地名', '现代地名', '经度', '纬度', '省', '市', '区县', '行政级别', '数据来源'],
            data,
            sheet_name='Places',
        )

    async def export_places_shapefile(self) -> bytes:
        """导出古今地名映射表为Shapefile ZIP"""
        rows = (await self.db.execute(select(PlaceName).order_by(PlaceName.ancient_name))).scalars().all()
        fields = [
            ('ancient', 'C', 100),
            ('modern', 'C', 100),
            ('prov', 'C', 50),
            ('city', 'C', 50),
            ('dist', 'C', 50),
            ('level', 'N', 3),
            ('source', 'C', 100),
        ]
        records = [
            {
                'lon': p.wgs84_lon,
                'lat': p.wgs84_lat,
                'values': [
                    p.ancient_name or '', p.modern_name or '', p.province or '', p.city or '',
                    p.district or '', p.admin_level or 0, p.source or '',
                ],
            }
            for p in rows
        ]
        return self._write_shapefile('places', fields, records)

    async def export_trajectories_excel(self, poet_id: Optional[str] = None) -> bytes:
        """导出轨迹数据为Excel"""
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

        data = [
            [
                r['poet_name'], r['event_year'], r['ancient_place'] or '', r['wgs84_lon'] or '',
                r['wgs84_lat'] or '', r['event_type'], r['stay_duration_days'] or '',
            ]
            for r in rows
        ]
        return self._write_excel(
            ['诗人', '年份', '地点', '经度', '纬度', '事件类型', '停留天数'],
            data,
            sheet_name='Trajectories',
        )

    async def export_trajectories_shapefile(self, poet_id: Optional[str] = None) -> bytes:
        """导出轨迹事件为Shapefile ZIP"""
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

        fields = [
            ('poet', 'C', 60),
            ('year', 'C', 20),
            ('place', 'C', 100),
            ('etype', 'C', 30),
            ('stay', 'N', 5),
        ]
        records = [
            {
                'lon': r['wgs84_lon'] or 0,
                'lat': r['wgs84_lat'] or 0,
                'values': [
                    r['poet_name'] or '', r['event_year'] or '', r['ancient_place'] or '',
                    r['event_type'] or '', r['stay_duration_days'] or 0,
                ],
            }
            for r in rows if r['wgs84_lon'] is not None and r['wgs84_lat'] is not None
        ]
        return self._write_shapefile('trajectories', fields, records)

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
