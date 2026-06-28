"""
互动娱乐 API — 飞花令 / 每日诗词 / 随机推荐 / 同主题
"""
import random
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.poetry import Poetry, PoetryFeature
from app.models.poet import Poet

router = APIRouter()


@router.get("/daily")
async def get_daily_poem(db: AsyncSession = Depends(get_db)):
    """每日一诗 — 按日期种子随机"""
    seed = date.today().toordinal()
    random.seed(seed)

    # 随机获取一首有特征标注的诗
    stmt = text("""
        SELECT p.poetry_id, p.title, p.content, p.dynasty, p.genre,
               po.name as author,
               pf.mood_tags, pf.imagery_items, pf.season
        FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        JOIN poets po ON po.poet_id = p.author_id
        ORDER BY RANDOM() LIMIT 1
    """)
    row = (await db.execute(stmt)).mappings().first()
    if not row:
        return {"error": "no poetry found"}

    import json
    result = {
        "poetry_id": str(row["poetry_id"]),
        "title": row["title"],
        "content": row["content"],
        "author": row["author"],
        "dynasty": row["dynasty"],
        "genre": row["genre"] or "",
        "mood_tags": json.loads(row["mood_tags"]) if isinstance(row["mood_tags"], str) else (row["mood_tags"] or []),
        "imagery_items": json.loads(row["imagery_items"]) if isinstance(row["imagery_items"], str) else (row["imagery_items"] or []),
        "season": json.loads(row["season"]) if isinstance(row["season"], str) else (row["season"] or []),
        "date": date.today().isoformat(),
    }
    return result


@router.get("/poem/{poetry_id}")
async def get_poem_by_id(poetry_id: str, db: AsyncSession = Depends(get_db)):
    """按 ID 获取单首诗词"""
    stmt = text("""
        SELECT p.poetry_id, p.title, p.content, p.dynasty, p.genre,
               po.name as author,
               pf.mood_tags, pf.imagery_items, pf.season
        FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        JOIN poets po ON po.poet_id = p.author_id
        WHERE p.poetry_id = :pid
        LIMIT 1
    """)
    row = (await db.execute(stmt, {"pid": poetry_id})).mappings().first()
    if not row:
        return {"error": "poem not found"}

    import json
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
    }


@router.get("/random")
async def get_random_poem(db: AsyncSession = Depends(get_db)):
    """随机一首诗"""
    stmt = text("""
        SELECT p.poetry_id, p.title, p.content, p.dynasty, p.genre,
               po.name as author,
               pf.mood_tags, pf.imagery_items
        FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        JOIN poets po ON po.poet_id = p.author_id
        ORDER BY RANDOM() LIMIT 1
    """)
    row = (await db.execute(stmt)).mappings().first()
    if not row:
        return {"error": "no poetry found"}

    import json
    return {
        "poetry_id": str(row["poetry_id"]),
        "title": row["title"],
        "content": row["content"],
        "author": row["author"],
        "dynasty": row["dynasty"],
        "genre": row["genre"] or "",
        "mood_tags": json.loads(row["mood_tags"]) if isinstance(row["mood_tags"], str) else (row["mood_tags"] or []),
        "imagery_items": json.loads(row["imagery_items"]) if isinstance(row["imagery_items"], str) else (row["imagery_items"] or []),
    }


@router.get("/related")
async def get_related_poems(
    poetry_id: str = Query(..., description="当前诗词ID"),
    mode: str = Query("mood", description="推荐模式: mood/author/random"),
    db: AsyncSession = Depends(get_db),
):
    """同主题/同作者推荐"""
    # 获取当前诗的信息
    poem = (await db.execute(select(Poetry).where(Poetry.poetry_id == poetry_id))).scalar_one_or_none()
    if not poem:
        return {"error": "poem not found"}

    feat = (await db.execute(select(PoetryFeature).where(PoetryFeature.poetry_id == poetry_id))).scalar_one_or_none()

    import json
    mood_tags = []
    if feat and feat.mood_tags:
        mood_tags = json.loads(feat.mood_tags) if isinstance(feat.mood_tags, str) else feat.mood_tags

    if mode == "author":
        # 同作者
        stmt = text("""
            SELECT p.poetry_id, p.title, p.content, p.dynasty, po.name as author
            FROM poetry p JOIN poets po ON po.poet_id = p.author_id
            WHERE p.author_id = :aid AND p.poetry_id != :pid
            ORDER BY RANDOM() LIMIT 5
        """)
        rows = (await db.execute(stmt, {"aid": poem.author_id, "pid": poetry_id})).mappings().all()
    elif mode == "mood" and mood_tags:
        # 同意境（匹配 mood_tags）
        tag = mood_tags[0]
        stmt = text("""
            SELECT p.poetry_id, p.title, p.content, p.dynasty, po.name as author
            FROM poetry p
            JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
            JOIN poets po ON po.poet_id = p.author_id
            WHERE pf.mood_tags LIKE :tag AND p.poetry_id != :pid
            ORDER BY RANDOM() LIMIT 5
        """)
        rows = (await db.execute(stmt, {"tag": f"%{tag}%", "pid": poetry_id})).mappings().all()
    else:
        # 随机推荐
        stmt = text("""
            SELECT p.poetry_id, p.title, p.content, p.dynasty, po.name as author
            FROM poetry p JOIN poets po ON po.poet_id = p.author_id
            WHERE p.poetry_id != :pid
            ORDER BY RANDOM() LIMIT 5
        """)
        rows = (await db.execute(stmt, {"pid": poetry_id})).mappings().all()

    return {
        "mode": mode,
        "current_title": poem.title,
        "related": [{
            "poetry_id": str(r["poetry_id"]),
            "title": r["title"],
            "author": r["author"],
        } for r in rows]
    }


@router.post("/feihualing")
async def feihualing(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """飞花令 — 输入一个汉字，返回含该字的诗句"""
    char = body.get("char", "").strip()
    exclude_ids = body.get("exclude_ids", [])

    if not char or len(char) != 1:
        return {"error": "请输入一个汉字"}

    # 查询含该字的诗句（排除已用过的）
    stmt = text("""
        SELECT p.poetry_id, p.title, p.content, p.dynasty, po.name as author
        FROM poetry p
        JOIN poets po ON po.poet_id = p.author_id
        WHERE p.content LIKE :char
        ORDER BY RANDOM() LIMIT 1
    """)
    row = (await db.execute(stmt, {"char": f"%{char}%"})).mappings().first()

    if not row:
        return {"char": char, "poem": None, "message": f"没有找到含「{char}」的诗句"}

    # 从内容中提取包含该字的句子
    lines = [l.strip() for l in row["content"].replace("。", "。\n").replace("？", "？\n").replace("！", "！\n").split("\n") if l.strip()]
    matching_lines = [l for l in lines if char in l]

    return {
        "char": char,
        "poem": {
            "poetry_id": str(row["poetry_id"]),
            "title": row["title"],
            "author": row["author"],
            "dynasty": row["dynasty"],
            "content": row["content"],
            "matching_line": matching_lines[0] if matching_lines else "",
        },
    }
