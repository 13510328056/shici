"""
chinese-poetry 数据导入脚本

从本地克隆的 chinese-poetry 仓库（https://github.com/chinese-poetry/chinese-poetry）
导入精选诗词数据到项目数据库。

导入范围（B方案 + 非诗词文本）：
  唐诗三百首 | 宋词三百首 | 元曲 | 诗经 | 楚辞 | 纳兰性德 | 曹操诗集
  四书五经（大学/中庸/孟子）| 蒙学 | 论语 | 幽梦影

用法: python scripts/import_chinese_poetry.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

# ── 环境配置 ─────────────────────────────────────
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./poetry_space_dev.db"
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)

DB_URL = "sqlite+aiosqlite:///./poetry_space_dev.db"
engine = create_async_engine(
    DB_URL, echo=False, connect_args={"check_same_thread": False}
)

from app.core.database import Base
from app.core.compat import utcnow
from app.models.poet import Poet
from app.models.poetry import Poetry, PoetryFeature

# ── chinese-poetry 仓库路径 ─────────────────────
SRC = Path(r"E:\PythonPrj\GSC\chinese-poetry")

# ==========================================================
#  诗人缓存（避免重复查库）
# ==========================================================
_poet_cache: dict[tuple[str, str], Poet] = {}
_fallback_poets: dict[str, str] = {}  # name -> dynasty for fallback


async def _load_poet_cache(session: AsyncSession):
    """从数据库加载已有诗人到缓存"""
    result = await session.execute(select(Poet))
    for poet in result.scalars():
        _poet_cache[(poet.name, poet.dynasty)] = poet
        # 也建立 name-only 索引用于朝代未知时的回退
        _fallback_poets[poet.name] = poet.dynasty


async def get_or_create_poet(
    session: AsyncSession,
    name: str,
    dynasty: str,
    description: str | None = None,
    birth_year: str | None = None,
    death_year: str | None = None,
) -> Poet:
    """按 (name, dynasty) 获取或创建诗人"""
    if not name or name == "佚名":
        name = "佚名"

    key = (name, dynasty)
    if key in _poet_cache:
        poet = _poet_cache[key]
        # 补全 description（仅首次导入时写入）
        if description and not poet.description:
            poet.description = description
        return poet

    # 尝试从数据库查找
    result = await session.execute(
        select(Poet).where(Poet.name == name, Poet.dynasty == dynasty)
    )
    poet = result.scalar_one_or_none()
    if poet:
        _poet_cache[key] = poet
        _fallback_poets[name] = dynasty
        return poet

    # 创建新诗人
    poet = Poet(
        name=name,
        dynasty=dynasty,
        description=description,
        birth_year=birth_year,
        death_year=death_year,
        created_at=utcnow(),
    )
    session.add(poet)
    await session.flush()
    _poet_cache[key] = poet
    _fallback_poets[name] = dynasty
    return poet


# ==========================================================
#  诗词排重
# ==========================================================
async def poem_exists(session: AsyncSession, title: str, author_id: str) -> bool:
    result = await session.execute(
        select(Poetry.poetry_id).where(
            Poetry.title == title, Poetry.author_id == author_id
        )
    )
    return result.scalar_one_or_none() is not None


# ==========================================================
#  数据集处理器
# ==========================================================

async def import_tang_300(session: AsyncSession) -> int:
    """唐诗三百首（全唐诗/唐诗三百首.json）"""
    # 加载作者传记字典
    author_desc = {}
    with open(SRC / "全唐诗" / "authors.tang.json", "r", encoding="utf-8") as f:
        for a in json.load(f):
            name = a.get("name", "").strip()
            desc = a.get("desc", "").strip()
            if name and desc:
                author_desc[name] = desc

    with open(SRC / "全唐诗" / "唐诗三百首.json", "r", encoding="utf-8") as f:
        poems = json.load(f)

    count = 0
    for p in poems:
        author_name = p.get("author", "佚名").strip()
        title = (p.get("title") or "").strip()
        if not title:
            title = "无题"
        paragraphs = p.get("paragraphs", [])
        content = "\n".join(paragraphs) if paragraphs else ""
        if not content:
            continue

        poet = await get_or_create_poet(
            session, author_name, "唐", description=author_desc.get(author_name)
        )
        if await poem_exists(session, title, poet.poet_id):
            continue

        tags = p.get("tags", [])
        poem = Poetry(
            title=title,
            author_id=poet.poet_id,
            dynasty="唐",
            content=content,
            genre="诗",
            created_at=utcnow(),
        )
        session.add(poem)
        await session.flush()

        feat = PoetryFeature(poetry_id=poem.poetry_id, mood_tags=tags)
        session.add(feat)
        count += 1

    return count


async def import_song_ci_300(session: AsyncSession) -> int:
    """宋词三百首（宋词/宋词三百首.json）"""
    author_desc = {}
    with open(SRC / "宋词" / "author.song.json", "r", encoding="utf-8") as f:
        for a in json.load(f):
            name = a.get("name", "").strip()
            desc = a.get("description", "").strip()
            if name and desc:
                author_desc[name] = desc

    with open(SRC / "宋词" / "宋词三百首.json", "r", encoding="utf-8") as f:
        poems = json.load(f)

    count = 0
    for p in poems:
        author_name = p.get("author", "佚名").strip()
        title = f"{p.get('rhythmic', '')}" if p.get("rhythmic") else "无题"
        paragraphs = p.get("paragraphs", [])
        content = "\n".join(paragraphs) if paragraphs else ""
        if not content:
            continue

        poet = await get_or_create_poet(
            session, author_name, "宋", description=author_desc.get(author_name)
        )
        if await poem_exists(session, title, poet.poet_id):
            continue

        tags = p.get("tags", [])
        poem = Poetry(
            title=title,
            author_id=poet.poet_id,
            dynasty="宋",
            content=content,
            genre="词",
            rhythm_pattern=p.get("rhythmic"),
            created_at=utcnow(),
        )
        session.add(poem)
        await session.flush()

        feat = PoetryFeature(poetry_id=poem.poetry_id, mood_tags=tags)
        session.add(feat)
        count += 1

    return count


async def import_yuan_qu(session: AsyncSession) -> int:
    """元曲（元曲/yuanqu.json）"""
    with open(SRC / "元曲" / "yuanqu.json", "r", encoding="utf-8") as f:
        items = json.load(f)

    count = 0
    for p in items:
        author_name = p.get("author", "佚名").strip()
        # 清理作者名（有些含额外信息如 "刘唐卿《白兔记》"）
        author_name = author_name.split("《")[0].strip()
        if not author_name:
            author_name = "佚名"

        title = (p.get("title") or "").strip()
        if not title:
            title = "无题"
        paragraphs = p.get("paragraphs", [])
        content = "\n".join(paragraphs) if paragraphs else ""
        if not content:
            continue

        poet = await get_or_create_poet(session, author_name, "元")
        if await poem_exists(session, title, poet.poet_id):
            continue

        poem = Poetry(
            title=title,
            author_id=poet.poet_id,
            dynasty="元",
            content=content,
            genre="曲",
            created_at=utcnow(),
        )
        session.add(poem)
        count += 1

        if count % 500 == 0:
            await session.flush()
            print(f"    元曲进度: {count}/11057")

    return count


async def import_shijing(session: AsyncSession) -> int:
    """诗经（诗经/shijing.json）"""
    with open(SRC / "诗经" / "shijing.json", "r", encoding="utf-8") as f:
        items = json.load(f)

    poet = await get_or_create_poet(session, "佚名", "先秦")

    count = 0
    for p in items:
        title = (p.get("title") or "").strip()
        if not title:
            title = "无题"
        content_list = p.get("content", [])
        content = "\n".join(content_list) if content_list else ""
        if not content:
            continue

        if await poem_exists(session, title, poet.poet_id):
            continue

        chapter = p.get("chapter", "")
        section = p.get("section", "")
        tags = []
        if chapter:
            tags.append(chapter)
        if section:
            tags.append(section)

        poem = Poetry(
            title=title,
            author_id=poet.poet_id,
            dynasty="先秦",
            content=content,
            genre="诗",
            created_at=utcnow(),
        )
        session.add(poem)
        await session.flush()

        feat = PoetryFeature(poetry_id=poem.poetry_id, mood_tags=tags)
        session.add(feat)
        count += 1

    return count


async def import_chuci(session: AsyncSession) -> int:
    """楚辞（楚辞/chuci.json）"""
    with open(SRC / "楚辞" / "chuci.json", "r", encoding="utf-8") as f:
        items = json.load(f)

    count = 0
    for p in items:
        author_name = p.get("author", "屈原").strip()
        title = (p.get("title") or "").strip()
        if not title:
            title = "无题"
        content_list = p.get("content", [])
        content = "\n".join(content_list) if content_list else ""
        if not content:
            continue

        poet = await get_or_create_poet(session, author_name, "战国")
        if await poem_exists(session, title, poet.poet_id):
            continue

        section = p.get("section", "")
        poem = Poetry(
            title=title,
            author_id=poet.poet_id,
            dynasty="战国",
            content=content,
            genre="楚辞",
            created_at=utcnow(),
        )
        session.add(poem)
        await session.flush()

        feat = PoetryFeature(poetry_id=poem.poetry_id, mood_tags=[section] if section else [])
        session.add(feat)
        count += 1

    return count


async def import_nalanxingde(session: AsyncSession) -> int:
    """纳兰性德（纳兰性德/纳兰性德诗集.json）"""
    with open(SRC / "纳兰性德" / "纳兰性德诗集.json", "r", encoding="utf-8") as f:
        items = json.load(f)

    poet = await get_or_create_poet(session, "纳兰性德", "清")

    count = 0
    for p in items:
        title = (p.get("title") or "").strip()
        if not title:
            title = "无题"
        # 注意字段名是 "para" 不是 "paragraphs"
        paragraphs = p.get("para") or p.get("paragraphs") or []
        content = "\n".join(paragraphs) if isinstance(paragraphs, list) else str(paragraphs)
        if not content:
            continue

        if await poem_exists(session, title, poet.poet_id):
            continue

        poem = Poetry(
            title=title,
            author_id=poet.poet_id,
            dynasty="清",
            content=content,
            genre="词",
            created_at=utcnow(),
        )
        session.add(poem)
        count += 1

    return count


async def import_caocao(session: AsyncSession) -> int:
    """曹操诗集（曹操诗集/caocao.json）"""
    with open(SRC / "曹操诗集" / "caocao.json", "r", encoding="utf-8") as f:
        items = json.load(f)

    poet = await get_or_create_poet(
        session, "曹操", "汉", description="曹操（155年－220年），字孟德，东汉末年政治家、军事家、文学家。"
    )

    count = 0
    for p in items:
        title = (p.get("title") or "").strip()
        if not title:
            title = "无题"
        paragraphs = p.get("paragraphs", [])
        content = "\n".join(paragraphs) if paragraphs else ""
        if not content:
            continue

        if await poem_exists(session, title, poet.poet_id):
            continue

        poem = Poetry(
            title=title,
            author_id=poet.poet_id,
            dynasty="汉",
            content=content,
            genre="诗",
            created_at=utcnow(),
        )
        session.add(poem)
        count += 1

    return count


# ── 非诗词类文本 ────────────────────────────────

async def import_classics(session: AsyncSession) -> int:
    """四书五经（大学/中庸/孟子）"""
    count = 0

    # 大学
    with open(SRC / "四书五经" / "daxue.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    poet = await get_or_create_poet(session, "曾参", "春秋",
                                     description="曾子（前505年－前435年），名参，字子舆，孔子弟子。")
    title = "大学"
    if not await poem_exists(session, title, poet.poet_id):
        content = "\n\n".join(data.get("paragraphs", []))
        poem = Poetry(title=title, author_id=poet.poet_id, dynasty="春秋",
                       content=content, genre="经典", created_at=utcnow())
        session.add(poem)
        count += 1

    # 中庸
    with open(SRC / "四书五经" / "zhongyong.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    poet = await get_or_create_poet(session, "子思", "战国",
                                     description="子思（前483年－前402年），名伋，孔子之孙。")
    title = "中庸"
    if not await poem_exists(session, title, poet.poet_id):
        content = "\n\n".join(data.get("paragraphs", []))
        poem = Poetry(title=title, author_id=poet.poet_id, dynasty="战国",
                       content=content, genre="经典", created_at=utcnow())
        session.add(poem)
        count += 1

    # 孟子
    with open(SRC / "四书五经" / "mengzi.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    poet = await get_or_create_poet(session, "孟子", "战国",
                                     description="孟子（约前372年－前289年），名轲，战国时期儒家代表人物。")
    for i, chapter in enumerate(data):
        if isinstance(chapter, dict):
            title = chapter.get("chapter", f"孟子·第{i+1}章")
            paragraphs = chapter.get("paragraphs", [])
            content = "\n\n".join(paragraphs) if isinstance(paragraphs, list) else str(paragraphs)
            if await poem_exists(session, title, poet.poet_id):
                continue
            poem = Poetry(title=title, author_id=poet.poet_id, dynasty="战国",
                           content=content, genre="经典", created_at=utcnow())
            session.add(poem)
            count += 1

    return count


async def import_mengxue(session: AsyncSession) -> int:
    """蒙学经典"""
    count = 0
    mengxue_files = [
        ("sanzijing-new.json", "三字经", "王应麟", "宋",
         "王应麟（1223年－1296年），字伯厚，南宋学者。"),
        ("qianziwen.json", "千字文", "周兴嗣", "梁",
         "周兴嗣（？－521年），字思纂，南朝梁文学家。"),
        ("baijiaxing.json", "百家姓", "佚名", "宋"),
        ("dizigui.json", "弟子规", "李毓秀", "清",
         "李毓秀（1647年－1729年），字子潜，清代教育家。"),
        ("shenglvqimeng.json", "声律启蒙", "车万育", "清",
         "车万育（1632年－1705年），字双亭，清代学者。"),
        ("youxueqionglin.json", "幼学琼林", "程登吉", "明",
         "程登吉，字允升，明代学者。"),
        ("zengguangxianwen.json", "增广贤文", "佚名", "明"),
        ("zhuzijiaxun.json", "朱子家训", "朱柏庐", "清",
         "朱柏庐（1627年－1698年），名用纯，明末清初理学家。"),
        ("qianjiashi.json", "千家诗", "谢枋得", "宋",
         "谢枋得（1226年－1289年），字君直，宋代诗人。"),
        ("wenzimengqiu.json", "文字蒙求", "王筠", "清",
         "王筠（1784年－1854年），字贯山，清代文字学家。"),
    ]

    for filename, title, author_name, dynasty, *desc in mengxue_files:
        fp = SRC / "蒙学" / filename
        if not fp.exists():
            continue

        with open(fp, "r", encoding="utf-8") as f:
            data = json.load(f)

        desc_text = desc[0] if desc else None
        poet = await get_or_create_poet(session, author_name, dynasty, description=desc_text)

        # 提取文本内容（处理多种嵌套结构）
        content_text = ""
        if isinstance(data, dict):
            # 优先用 paragraphs（纯文本列表）
            raw = data.get("paragraphs")
            if raw and isinstance(raw, list):
                content_text = "\n".join(str(s) for s in raw if isinstance(s, str))
            else:
                # 尝试 content 字段
                raw = data.get("content", [])
                if isinstance(raw, list):
                    parts = []
                    for item in raw:
                        if isinstance(item, str):
                            parts.append(item)
                        elif isinstance(item, dict):
                            # 有 chapter/paragraphs 结构
                            ch = item.get("chapter", "")
                            paras = item.get("paragraphs", [])
                            section = f"【{ch}】\n" + "\n".join(paras) if ch else "\n".join(paras)
                            parts.append(section)
                        else:
                            parts.append(str(item))
                    content_text = "\n\n".join(parts)
                elif isinstance(raw, str):
                    content_text = raw
        elif isinstance(data, list):
            parts = []
            for item in data:
                if isinstance(item, dict):
                    paras = item.get("paragraphs", [])
                    parts.append("\n".join(paras) if isinstance(paras, list) else str(paras))
                elif isinstance(item, str):
                    parts.append(item)
                else:
                    parts.append(str(item))
            content_text = "\n\n".join(parts)
        else:
            content_text = str(data)

        content_text = content_text.strip()
        if not content_text:
            continue

        if await poem_exists(session, title, poet.poet_id):
            continue

        poem = Poetry(
            title=title,
            author_id=poet.poet_id,
            dynasty=dynasty,
            content=content_text,
            genre="蒙学",
            created_at=utcnow(),
        )
        session.add(poem)
        count += 1

    return count


async def import_lunyu(session: AsyncSession) -> int:
    """论语（论语/lunyu.json）"""
    with open(SRC / "论语" / "lunyu.json", "r", encoding="utf-8") as f:
        chapters = json.load(f)

    poet = await get_or_create_poet(
        session, "孔子", "春秋",
        description="孔子（前551年－前479年），名丘，字仲尼，儒家学派创始人。"
    )

    count = 0
    for ch in chapters:
        title = (ch.get("chapter") or "").strip()
        if not title:
            continue
        paragraphs = ch.get("paragraphs", [])
        content = "\n\n".join(paragraphs) if isinstance(paragraphs, list) else str(paragraphs)
        if not content:
            continue
        if await poem_exists(session, title, poet.poet_id):
            continue
        poem = Poetry(
            title=title, author_id=poet.poet_id, dynasty="春秋",
            content=content, genre="经典", created_at=utcnow(),
        )
        session.add(poem)
        count += 1

    return count


async def import_youmengying(session: AsyncSession) -> int:
    """幽梦影（幽梦影/youmengying.json）"""
    with open(SRC / "幽梦影" / "youmengying.json", "r", encoding="utf-8") as f:
        items = json.load(f)

    poet = await get_or_create_poet(
        session, "张潮", "清",
        description="张潮（1650年－1707年），字山来，号心斋，清代文学家。"
    )

    count = 0
    for i, item in enumerate(items):
        content_text = item.get("content", "").strip()
        if not content_text:
            continue
        # 用前10个字做标题
        title = content_text[:12] + ("…" if len(content_text) > 12 else "")
        if await poem_exists(session, title, poet.poet_id):
            # 标题冲突时加序号
            title = f"{content_text[:10]}…({i+1})"
            if await poem_exists(session, title, poet.poet_id):
                continue

        poem = Poetry(
            title=title, author_id=poet.poet_id, dynasty="清",
            content=content_text, genre="笔记", created_at=utcnow(),
        )
        session.add(poem)
        count += 1

    return count


# ==========================================================
#  主流程
# ==========================================================

async def main():
    print("=" * 60)
    print("  chinese-poetry 数据导入")
    print(f"  来源: {SRC}")
    print(f"  数据库: {DB_URL}")
    print("=" * 60)

    # 确保表结构
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 确保 description 列存在
        result = await conn.execute(text("PRAGMA table_info(poets)"))
        cols = [row[1] for row in result]
        if "description" not in cols:
            await conn.execute(text("ALTER TABLE poets ADD COLUMN description TEXT"))

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        # 加载已有诗人缓存
        await _load_poet_cache(session)
        print(f"\n[预热] 已缓存 {len(_poet_cache)} 位现有诗人\n")

        # ── 按顺序导入各数据集 ──
        pipelines = [
            ("唐诗三百首", import_tang_300),
            ("宋词三百首", import_song_ci_300),
            ("元曲", import_yuan_qu),
            ("诗经", import_shijing),
            ("楚辞", import_chuci),
            ("纳兰性德", import_nalanxingde),
            ("曹操诗集", import_caocao),
            ("四书五经", import_classics),
            ("蒙学", import_mengxue),
            ("论语", import_lunyu),
            ("幽梦影", import_youmengying),
        ]

        totals = {}
        for name, handler in pipelines:
            print(f"[{name}] 导入中...")
            try:
                cnt = await handler(session)
                await session.flush()
                await session.commit()  # 每个数据集独立提交
                totals[name] = cnt
                print(f"  OK 新增 {cnt} 条")
            except Exception as e:
                await session.rollback()
                print(f"  失败: {e}")
                # 继续下一个数据集

        # ── 最终统计 ──
        print("\n" + "=" * 60)
        print("  导入统计")
        print("=" * 60)
        for name, cnt in totals.items():
            print(f"  {name}: +{cnt}")
        print("-" * 60)
        print(f"  总计新增: {sum(totals.values())} 条")

        print("\n" + "=" * 60)
        # 全库统计
        for model, label in [(Poet, "诗人"), (Poetry, "诗词"), (PoetryFeature, "标注")]:
            c = (
                await session.execute(select(func.count()).select_from(model))
            ).scalar()
            print(f"  全库 {label}: {c}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
