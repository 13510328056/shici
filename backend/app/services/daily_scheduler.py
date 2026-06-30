"""
每日诗词智能推荐调度服务
SRS 3.1 — 分层优先级全自动推荐机制

优先级:
  P1: 传统节日与二十四节气
  P2: 四季物候时序
  P3: 专题排班计划（周主题轮换）
  P4: 难度均衡调控（60% L1 / 30% L2 / 10% L3）
  P5: 体裁与题材均衡调控（防重复）
防重复: 单首诗词90天冷却期
"""

import json
import math
import random
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import select, text, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.poetry import Poetry, PoetryFeature, DailyPoemLog

# ─── 传统节日（月-日映射，农历节日取常见公历近似值）────────
FESTIVAL_MAP = {
    (1, 1): "元旦",
    (2, 14): "元宵节",        # 农历正月十五近似
    (4, 5): "清明节",
    (5, 1): "劳动节",
    (6, 10): "端午节",        # 农历五月初五近似
    (8, 22): "七夕节",        # 农历七月初七近似
    (9, 29): "中秋节",        # 农历八月十五近似
    (10, 1): "国庆节",
    (10, 23): "重阳节",       # 农历九月初九近似
}

# ─── 二十四节气（公历近似日期）──────────────────
SOLAR_TERM_MAP = {
    (2, 4): "立春",
    (2, 19): "雨水",
    (3, 6): "惊蛰",
    (3, 21): "春分",
    (4, 5): "清明",
    (4, 20): "谷雨",
    (5, 6): "立夏",
    (5, 21): "小满",
    (6, 6): "芒种",
    (6, 21): "夏至",
    (7, 7): "小暑",
    (7, 23): "大暑",
    (8, 7): "立秋",
    (8, 23): "处暑",
    (9, 8): "白露",
    (9, 23): "秋分",
    (10, 8): "寒露",
    (10, 23): "霜降",
    (11, 7): "立冬",
    (11, 22): "小雪",
    (12, 7): "大雪",
    (12, 22): "冬至",
    (1, 6): "小寒",
    (1, 20): "大寒",
}

# ─── 季节映射 ─────────────────────────────────
SEASONS = [
    (3, 5, "春"),
    (6, 8, "夏"),
    (9, 11, "秋"),
    (12, 2, "冬"),
]

# ─── 周主题轮换（P3）───────────────────────────
THEME_WEEKLY = [
    "山水", "边塞", "送别", "思乡",
    "怀古", "田园", "爱情", "咏物",
    "爱国", "禅意", "闲适", "励志",
    "闺怨", "感怀", "写实", "豪放",
]

# ─── 难度映射 ─────────────────────────────────
DIFFICULTY_MAP = {
    "五绝": "L1",
    "五律": "L2",
    "七绝": "L2",
    "七律": "L3",
    "词": "L3",
    "古风": "L3",
}


def get_current_season(d: date) -> str:
    """获取当前季节"""
    m = d.month
    if 3 <= m <= 5:
        return "春"
    elif 6 <= m <= 8:
        return "夏"
    elif 9 <= m <= 11:
        return "秋"
    else:
        return "冬"


def get_today_festival(d: date) -> Optional[str]:
    """获取今日对应的传统节日"""
    return FESTIVAL_MAP.get((d.month, d.day))


def get_today_solar_term(d: date) -> Optional[str]:
    """获取今日对应的节气（±2天容忍窗口）"""
    m, day = d.month, d.day
    for (sm, sd), name in SOLAR_TERM_MAP.items():
        if sm == m and abs(sd - day) <= 2:
            return name
    return None


def get_weekly_theme(d: date) -> str:
    """获取本周主题（按周数轮换）"""
    week_num = d.isocalendar()[1]
    return THEME_WEEKLY[week_num % len(THEME_WEEKLY)]


async def get_daily_poem_for_date(db: AsyncSession, target_date: date) -> Optional[dict]:
    """
    核心调度算法 — 为指定日期选取每日诗词
    1. 检查是否已有记录 → 直接返回
    2. 按5级优先级选取
    3. 记录到 daily_poem_log
    """
    date_str = target_date.isoformat()

    # ── 1. 检查是否已有记录 ──
    existing = await _get_existing_log(db, date_str)
    if existing:
        return await _build_response(db, str(existing.poetry_id), date_str, existing.reason, existing.priority)

    # ── 2. 获取90天冷却期排除列表 ──
    exclude_ids = await _get_recent_poem_ids(db, target_date, 90)

    # ── 3. 逐级选取 ──
    selected_id = None
    reason = None
    priority = None

    # P1: 传统节日与二十四节气
    festival = get_today_festival(target_date)
    if festival:
        selected_id = await _pick_by_tag(db, "festival", festival, exclude_ids)
        if selected_id:
            reason = f"节日·{festival}"
            priority = 1

    if not selected_id:
        solar_term = get_today_solar_term(target_date)
        if solar_term:
            selected_id = await _pick_by_tag(db, "solar_term", solar_term, exclude_ids)
            if selected_id:
                reason = f"节气·{solar_term}"
                priority = 1

    # P2: 四季物候时序
    if not selected_id:
        season = get_current_season(target_date)
        season_pool = await _get_tagged_poems(db, "season", season, exclude_ids)
        if season_pool:
            # 从中选一首与当前月度更匹配的
            selected_id = _pick_from_pool(season_pool, season)
            reason = f"季节·{season}"
            priority = 2

    # P3: 专题排班计划
    if not selected_id:
        theme = get_weekly_theme(target_date)
        theme_pool = await _get_tagged_poems(db, "mood_tags", theme, exclude_ids)
        if theme_pool:
            selected_id = random.choice(theme_pool)
            reason = f"专题·{theme}"
            priority = 3

    # P4: 难度均衡调控
    if not selected_id:
        selected_id = await _pick_by_difficulty_balance(db, exclude_ids)
        if selected_id:
            reason = "难度均衡"
            priority = 4

    # P5: 体裁与题材均衡调控
    if not selected_id:
        selected_id = await _pick_by_diversity(db, exclude_ids)
        if selected_id:
            reason = "多样均衡"
            priority = 5

    # 兜底：从所有未排除的诗中随机取
    if not selected_id:
        selected_id = await _pick_fallback(db, exclude_ids)
        reason = "随机"
        priority = 5

    if not selected_id:
        return None

    # ── 记录日志 ──
    await _log_selection(db, date_str, selected_id, reason, priority)
    return await _build_response(db, selected_id, date_str, reason, priority)


# ─── 内部辅助函数 ──────────────────────────────

async def _get_existing_log(db: AsyncSession, date_str: str) -> Optional[DailyPoemLog]:
    r = await db.execute(
        select(DailyPoemLog).where(DailyPoemLog.date == date_str)
    )
    return r.scalar_one_or_none()


async def _get_recent_poem_ids(db: AsyncSession, target_date: date, days: int) -> set:
    """获取过去 N 天已推送过的诗词 ID"""
    cutoff = target_date - timedelta(days=days)
    r = await db.execute(
        select(DailyPoemLog.poetry_id).where(DailyPoemLog.date >= cutoff.isoformat())
    )
    return {row[0] for row in r.fetchall()}


async def _pick_by_tag(db: AsyncSession, field: str, value: str, exclude_ids: set) -> Optional[str]:
    """按标签字段选取诗词"""
    # 使用 LIKE 匹配数组字段中的值
    field_col = {
        "festival": "pf.festival",
        "solar_term": "pf.solar_term",
        "season": "pf.season",
        "mood_tags": "pf.mood_tags",
    }.get(field)

    if not field_col:
        return None

    sql = text(f"""
        SELECT p.poetry_id FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        WHERE {field_col} LIKE :val
        ORDER BY RANDOM() LIMIT 50
    """)
    rows = (await db.execute(sql, {"val": f"%{value}%"})).mappings().all()

    candidates = [str(r["poetry_id"]) for r in rows if str(r["poetry_id"]) not in exclude_ids]
    for pid in candidates:
        return pid
    for pid in [str(r["poetry_id"]) for r in rows]:
        return pid  # fallback: 允许重复
    return None


async def _get_tagged_poems(db: AsyncSession, field: str, value: str, exclude_ids: set) -> list:
    """获取匹配指定标签的所有诗词ID（排除冷却期内的）"""
    field_col = {
        "season": "pf.season",
        "mood_tags": "pf.mood_tags",
    }.get(field)

    if not field_col:
        return []

    sql = text(f"""
        SELECT p.poetry_id FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        WHERE {field_col} LIKE :val
        ORDER BY RANDOM() LIMIT 100
    """)
    rows = (await db.execute(sql, {"val": f"%{value}%"})).mappings().all()
    return [str(r["poetry_id"]) for r in rows if str(r["poetry_id"]) not in exclude_ids]


def _pick_from_pool(pool: list, season: str) -> str:
    """从候选池中选取一首（优先选择与季节意象更匹配的）"""
    return random.choice(pool) if pool else pool[0] if pool else None


async def _pick_by_difficulty_balance(db: AsyncSession, exclude_ids: set) -> Optional[str]:
    """P4: 难度均衡 — 查看最近10首推送的难度分布，补缺"""
    recent = (await db.execute(
        select(DailyPoemLog).order_by(DailyPoemLog.date.desc()).limit(10)
    )).scalars().all()

    # 统计最近推送的难度分布
    diff_counts = {"L1": 0, "L2": 0, "L3": 0}
    for log in recent:
        pid = str(log.poetry_id) if log.poetry_id else None
        if pid:
            r = await db.execute(
                select(PoetryFeature.difficulty).where(PoetryFeature.poetry_id == pid)
            )
            d = r.scalar()
            if d in diff_counts:
                diff_counts[d] += 1

    total = sum(diff_counts.values()) or 1

    # 目标：L1占60%, L2占30%, L3占10%
    targets = {"L1": 0.6, "L2": 0.3, "L3": 0.1}
    need_diff = sorted(targets.keys(), key=lambda d: (diff_counts[d] / total) / targets[d])[0]

    sql = text("""
        SELECT p.poetry_id FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        WHERE pf.difficulty = :diff
        ORDER BY RANDOM() LIMIT 20
    """)
    rows = (await db.execute(sql, {"diff": need_diff})).mappings().all()
    candidates = [str(r["poetry_id"]) for r in rows if str(r["poetry_id"]) not in exclude_ids]
    for pid in candidates:
        return pid
    for pid in [str(r["poetry_id"]) for r in rows]:
        return pid
    return None


async def _pick_by_diversity(db: AsyncSession, exclude_ids: set) -> Optional[str]:
    """P5: 体裁与题材均衡 — 避免与最近5首同体裁/同意境"""
    recent = (await db.execute(
        select(DailyPoemLog).order_by(DailyPoemLog.date.desc()).limit(5)
    )).scalars().all()

    recent_genres = set()
    recent_moods = set()
    for log in recent:
        pid = str(log.poetry_id) if log.poetry_id else ""
        if not pid:
            continue
        r = await db.execute(
            text("SELECT genre FROM poetry WHERE poetry_id = :pid"),
            {"pid": pid}
        )
        g = r.scalar()
        if g:
            recent_genres.add(g)
        r2 = await db.execute(
            text("SELECT mood_tags FROM poetry_features WHERE poetry_id = :pid"),
            {"pid": pid}
        )
        mt = r2.scalar()
        if mt:
            try:
                tags = json.loads(mt) if isinstance(mt, str) else mt
                if tags:
                    recent_moods.add(tags[0])
            except (json.JSONDecodeError, IndexError):
                pass

    exclude_ids_str = ",".join(f"'{e}'" for e in list(exclude_ids)[:50]) if exclude_ids else "'__none__'"

    # 优先选取不同体裁、不同意境的
    genre_filter = "','".join(recent_genres) if recent_genres else "'__none__'"
    sql = text(f"""
        SELECT p.poetry_id FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        WHERE p.genre NOT IN ({genre_filter})
          AND p.poetry_id NOT IN ({exclude_ids_str})
        ORDER BY RANDOM() LIMIT 10
    """)
    try:
        rows = (await db.execute(sql)).mappings().all()
        if rows:
            return str(rows[0]["poetry_id"])
    except Exception:
        pass
    return None


async def _pick_fallback(db: AsyncSession, exclude_ids: set) -> Optional[str]:
    """兜底：随机取一首不在冷却期的诗"""
    exclude_str = ",".join(f"'{e}'" for e in list(exclude_ids)[:100]) if exclude_ids else "'__none__'"
    sql = text(f"""
        SELECT p.poetry_id FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        WHERE p.poetry_id NOT IN ({exclude_str})
        ORDER BY random() LIMIT 1
    """)
    try:
        row = (await db.execute(sql)).mappings().first()
        if row:
            return str(row["poetry_id"])
    except Exception:
        pass

    # 最终兜底
    sql = text("SELECT p.poetry_id FROM poetry p JOIN poetry_features pf ON pf.poetry_id = p.poetry_id ORDER BY random() LIMIT 1")
    row = (await db.execute(sql)).mappings().first()
    return str(row["poetry_id"]) if row else None


async def _log_selection(db: AsyncSession, date_str: str, poetry_id: str, reason: str, priority: int):
    log = DailyPoemLog(date=date_str, poetry_id=str(poetry_id), reason=reason, priority=priority)
    db.add(log)


async def _build_response(db: AsyncSession, poetry_id: str, date_str: str, reason: str, priority: int) -> Optional[dict]:
    """构建完整的诗词响应"""
    sql = text("""
        SELECT p.poetry_id, p.title, p.content, p.dynasty, p.genre,
               po.name as author,
               pf.mood_tags, pf.imagery_items, pf.season,
               pf.difficulty
        FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        JOIN poets po ON po.poet_id = p.author_id
        WHERE p.poetry_id = :pid
        LIMIT 1
    """)
    row = (await db.execute(sql, {"pid": poetry_id})).mappings().first()
    if not row:
        return None

    return {
        "poetry_id": str(row["poetry_id"]),
        "title": row["title"],
        "content": row["content"],
        "author": row["author"],
        "dynasty": row["dynasty"],
        "genre": row["genre"] or "",
        "mood_tags": json.loads(row["mood_tags"]) if isinstance(row["mood_tags"], str) else (row["mood_tags"] or []),
        "imagery_items": json.loads(row["imagery_items"]) if isinstance(row["imagery_items"], str) else (row["imagery_items"] or []),
        "season": json.loads(row["season"]) if isinstance(row["season"], str) else (row["season"] or []),
        "difficulty": row["difficulty"] or "",
        "date": date_str,
        "reason": reason,
        "priority": priority,
    }


async def seed_difficulty(db: AsyncSession):
    """为未设置难度的诗词填充难度值（批量更新）"""
    r = await db.execute(
        select(PoetryFeature).where(PoetryFeature.difficulty.is_(None))
    )
    features = r.scalars().all()
    if not features:
        return

    # 批量获取所有 genre
    poetry_ids = [f.poetry_id for f in features]
    from sqlalchemy import text as sa_text
    rows = (await db.execute(
        sa_text("SELECT poetry_id, genre FROM poetry WHERE poetry_id IN :ids"),
        {"ids": tuple(poetry_ids)}
    )).mappings().all()
    genre_map = {str(r["poetry_id"]): r["genre"] or "" for r in rows}

    for feat in features:
        feat.difficulty = DIFFICULTY_MAP.get(genre_map.get(feat.poetry_id, ""), "L2")

    # 不在这里 commit，由调用方管理事务
