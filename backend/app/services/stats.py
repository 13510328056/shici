"""
诗词统计分析服务 — 对应 SRS 第 3 章全功能需求
"""

import json
import re
from collections import Counter
from typing import Any

from sqlalchemy import select, func, text as sqltext
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.poet import Poet
from app.models.poetry import Poetry, PoetryFeature
from app.models.place_name import PlaceName

# ─── 常见词牌名（用于体裁分类） ─────────────────────────

COMMON_CIPAI: set[str] = {
    "水调歌头", "念奴娇", "沁园春", "满江红", "蝶恋花", "浣溪沙",
    "菩萨蛮", "卜算子", "清平乐", "如梦令", "西江月", "临江仙",
    "鹧鸪天", "虞美人", "浪淘沙", "渔家傲", "青玉案", "江城子",
    "醉花阴", "望江南", "采桑子", "点绛唇", "踏莎行", "苏幕遮",
    "雨霖铃", "声声慢", "永遇乐", "贺新郎", "桂枝香", "满庭芳",
    "摸鱼儿", "扬州慢", "一剪梅", "定风波", "破阵子", "生查子",
    "忆秦娥", "更漏子", "南歌子", "阮郎归", "画堂春", "鹊桥仙",
    "行香子", "小重山", "唐多令", "相见欢", "诉衷情", "南乡子",
    "玉蝴蝶", "风流子", "河传", "酒泉子", "山花子", "中兴乐",
    "醉花间", "恋情深", "纱窗恨", "望江怨", "感恩多", "长命女",
    "上行杯", "定西番", "赞浦子", "添声杨柳枝", "杨柳枝",
    "抛毬乐", "八拍蛮", "纥那曲", "啰唝曲", "竹枝", "潇湘神",
    "河渎神", "柘枝引", "塞姑", "晴偏好", "凭阑人", "花非花",
    "摘得新", "梧叶儿", "渔歌子", "调笑令", "三台", "荷叶杯",
    "甘州遍", "清平调", "谪仙怨", "桂殿秋", "南浦", "九张机",
    "字字双", "古调笑", "转应曲", "宫中调笑", "玉楼春",
    "夜行船", "感皇恩", "品令", "桃源忆故人", "东风第一枝",
    "渡江云", "绕佛阁", "绛都春", "惜黄花慢", "翠楼吟",
    "庆春泽", "大酺", "兰陵王", "六丑", "夜半乐", "宝鼎现",
    "莺啼序", "霓裳中序第一", "花犯", "暗香", "疏影",
    "减字木兰花", "祝英台近", "高阳台", "八声甘州", "齐天乐",
    "瑞鹤仙", "解连环", "喜迁莺", "双双燕", "风入松",
    "烛影摇红", "长亭怨慢", "六幺令", "瑶台聚八仙", "月上海棠",
}

COMMON_QUPAI: set[str] = {
    "天净沙", "山坡羊", "叨叨令", "滚绣球", "凭栏人",
    "落梅风", "水仙子", "庆东原", "折桂令", "沉醉东风",
    "雁儿落", "得胜令", "四块玉", "骂玉郎", "采茶歌",
    "红绣鞋", "普天乐", "清江引", "朝天子", "卖花声",
    "碧玉箫", "夜行船", "乔木查", "庆宣和", "殿前欢",
    "寄生草", "村里迓鼓", "元和令", "上马娇",
    "游四门", "柳叶儿", "青哥儿", "哪吒令", "鹊踏枝",
    "六幺序", "后庭花", "金盏儿", "醉扶归", "忆王孙",
    "一半儿", "端正好", "倘秀才", "脱布衫", "小梁州",
    "醉太平", "呆骨朵", "货郎儿", "九转货郎儿",
    "耍孩儿", "煞", "尾声", "哨遍",
}

# ─── 朝代排序（时间线用） ──────────────────────────────

DYNASTY_ORDER: list[str] = [
    "先秦", "秦汉", "汉", "魏晋", "南北朝", "魏晋南北朝", "隋",
    "唐", "五代", "五代十国", "宋", "辽", "金", "元",
    "明", "清", "近代", "现代",
]

# ─── 流派标签映射 ──────────────────────────────────────

SCHOOL_MAP: dict[str, list[str]] = {
    "山水田园派": ["山水", "田园"],
    "边塞派":     ["边塞"],
    "豪放派":     ["豪放"],
    "婉约派":     ["婉约"],
    "花间派":     ["花间"],
    "江西诗派":   ["江西诗派", "江西"],
}

LITERARY_GROUPS: dict[str, list[str]] = {
    "唐宋八大家": ["韩愈", "柳宗元", "欧阳修", "苏轼", "苏辙", "苏洵", "王安石", "曾巩"],
    "初唐四杰":   ["王勃", "杨炯", "卢照邻", "骆宾王"],
    "建安七子":   ["孔融", "陈琳", "王粲", "徐干", "阮瑀", "应玚", "刘桢"],
    "竹林七贤":   ["嵇康", "阮籍", "山涛", "向秀", "刘伶", "王戎", "阮咸"],
}


def _classify_poem_type(genre: str) -> str:
    """将体裁归类为 诗/词/曲/赋/古文"""
    g = genre.strip()
    # 直接匹配大类名称
    if g in ("诗",):
        return "诗"
    if g in ("词",):
        return "词"
    if g in ("曲",):
        return "曲"
    # 匹配细分子类 —— 词牌/曲牌名
    for cp in COMMON_CIPAI:
        if cp in g:
            return "词"
    for qp in COMMON_QUPAI:
        if qp in g:
            return "曲"
    if g == "赋" or g.endswith("赋"):
        return "赋"
    if g in ("古文", "笔记", "经典", "蒙学") or "文" in g:
        return "古文"
    # 楚辞等归类为诗
    if g in ("楚辞",):
        return "诗"
    return "诗"


def _parse_string_array(val: Any) -> list[str]:
    """将 StringArray 列的值解析为 Python 列表"""
    if val is None:
        return []
    if isinstance(val, list):
        return [str(v).strip() for v in val if v]
    if isinstance(val, str):
        try:
            items = json.loads(val)
            return [str(v).strip() for v in items if v] if isinstance(items, list) else [val.strip()]
        except (json.JSONDecodeError, TypeError):
            return [val.strip()]
    return []


def _dynasty_sort_key(dynasty: str) -> tuple[int, str]:
    """按 Dynasty_ORDER 排序"""
    try:
        return (DYNASTY_ORDER.index(dynasty), dynasty)
    except ValueError:
        return (99, dynasty)


class StatsService:
    """诗词统计分析服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_stats(self) -> dict:
        """聚合全部统计数据"""
        overview     = await self._get_overview()
        dynasties    = await self._get_dynasty_stats()
        timeline     = await self._get_timeline()
        genres_data  = await self._get_genre_stats()
        top_poets    = await self._get_top_poets()
        imagery      = await self._count_array_field(PoetryFeature.imagery_items, 30)
        moods        = await self._count_array_field(PoetryFeature.mood_tags, 20)
        allusions    = await self._count_array_field(PoetryFeature.allusion_names, 20)
        schools      = await self._get_school_stats()

        return {
            "overview":   overview,
            "dynasties":  dynasties,
            "timeline":   timeline,
            "genres":     genres_data["all"],
            "top_cipai":  genres_data["cipai"],
            "top_qupai":  genres_data["qupai"],
            "top_poets":  top_poets,
            "imagery":    imagery,
            "moods":      moods,
            "allusions":  allusions,
            "schools":    schools,
        }

    # ── 3.1.2.1 总量统计 ──────────────────────────────

    async def _get_overview(self) -> dict:
        poem_cnt  = (await self.db.execute(select(func.count()).select_from(Poetry))).scalar()
        poet_cnt  = (await self.db.execute(select(func.count()).select_from(Poet))).scalar()
        place_cnt = (await self.db.execute(select(func.count()).select_from(PlaceName))).scalar()

        rows = await self.db.execute(
            select(Poetry.genre, func.count().label("cnt"))
            .where(Poetry.genre.isnot(None))
            .group_by(Poetry.genre)
            .order_by(func.count().desc())
        )
        type_buckets: dict[str, int] = {"诗": 0, "词": 0, "曲": 0, "赋": 0, "古文": 0}
        ci_total = qu_total = 0
        for genre, cnt in rows:
            t = _classify_poem_type(genre)
            type_buckets[t] = type_buckets.get(t, 0) + cnt
            if t == "词":
                ci_total += cnt
            elif t == "曲":
                qu_total += cnt

        return {
            "total_poems":  poem_cnt,
            "total_poets":  poet_cnt,
            "total_places": place_cnt,
            "total_ci":     ci_total,
            "total_qu":     qu_total,
            "poem_types":   type_buckets,
        }

    # ── 3.1.2.1 朝代排行 ──────────────────────────────

    async def _get_dynasty_stats(self) -> list[dict]:
        rows = await self.db.execute(sqltext("""
            SELECT po.dynasty,
                   COUNT(DISTINCT p.poetry_id) AS poem_count,
                   COUNT(DISTINCT p.author_id)  AS poet_count
            FROM poetry p
            JOIN poets po ON po.poet_id = p.author_id
            WHERE po.dynasty IS NOT NULL AND po.dynasty != ''
            GROUP BY po.dynasty
            ORDER BY poem_count DESC
        """))
        return [
            {"dynasty": r[0], "poem_count": r[1], "poet_count": r[2]}
            for r in rows
        ]

    # ── 3.1.2.2 时间维度 ──────────────────────────────

    async def _get_timeline(self) -> list[dict]:
        """按朝代顺序返回各朝代作品数"""
        rows = await self.db.execute(sqltext("""
            SELECT po.dynasty, COUNT(*) AS cnt
            FROM poetry p
            JOIN poets po ON po.poet_id = p.author_id
            WHERE po.dynasty IS NOT NULL AND po.dynasty != ''
            GROUP BY po.dynasty
        """))
        raw: dict[str, int] = {r[0]: r[1] for r in rows}
        sorted_dynasties = sorted(raw.keys(), key=_dynasty_sort_key)
        return [{"year": d, "count": raw[d]} for d in sorted_dynasties]

    # ── 3.1.2.3 体裁统计 + 词牌/曲牌排行 ─────────────

    async def _get_genre_stats(self) -> dict[str, list[dict]]:
        rows = await self.db.execute(
            select(Poetry.genre, func.count().label("cnt"))
            .where(Poetry.genre.isnot(None), Poetry.genre != "")
            .group_by(Poetry.genre)
            .order_by(func.count().desc())
        )
        all_genres = [{"name": r[0], "count": r[1]} for r in rows]
        cipai = [g for g in all_genres if g["name"] in COMMON_CIPAI][:20]
        qupai = [g for g in all_genres if g["name"] in COMMON_QUPAI][:20]
        return {"all": all_genres, "cipai": cipai, "qupai": qupai}

    # ── 3.3.2.1 作者作品排行 ──────────────────────────

    async def _get_top_poets(self) -> list[dict]:
        rows = await self.db.execute(sqltext("""
            SELECT po.name, po.dynasty, COUNT(p.poetry_id) AS cnt
            FROM poetry p
            JOIN poets po ON po.poet_id = p.author_id
            GROUP BY p.author_id
            ORDER BY cnt DESC
            LIMIT 30
        """))
        return [{"name": r[0], "dynasty": r[1], "count": r[2]} for r in rows]

    # ── 3.2.2.2 / 3.2.2.3 / 3.2.2.4 文本分析 ─────────

    async def _count_array_field(self, column, limit: int) -> list[dict]:
        counter: Counter = Counter()
        rows = await self.db.execute(select(column).where(column.isnot(None)))
        for (val,) in rows:
            for item in _parse_string_array(val):
                counter[item] += 1
        return [{"name": k, "count": v} for k, v in counter.most_common(limit)]

    # ── 3.3.2.2 流派群体统计 ──────────────────────────

    async def _get_school_stats(self) -> list[dict]:
        rows = await self.db.execute(sqltext("""
            SELECT po.name, po.tags, CAST(COUNT(p.poetry_id) AS INTEGER) AS poem_count
            FROM poets po
            LEFT JOIN poetry p ON p.author_id = po.poet_id
            GROUP BY po.poet_id
        """))
        poet_infos = [{"name": r[0], "tags": _parse_string_array(r[1]), "poem_count": r[2]} for r in rows]

        results: list[dict] = []

        # 流派
        for school, keywords in SCHOOL_MAP.items():
            matched = [pi for pi in poet_infos if any(kw in tag for tag in pi["tags"] for kw in keywords)]
            results.append({
                "school": school,
                "poet_count": len(matched),
                "poem_count": sum(pi["poem_count"] for pi in matched),
            })

        # 文人组合
        for group, members in LITERARY_GROUPS.items():
            matched = [pi for pi in poet_infos if pi["name"] in members]
            results.append({
                "school": group,
                "poet_count": len(matched),
                "poem_count": sum(pi["poem_count"] for pi in matched),
            })

        return results
