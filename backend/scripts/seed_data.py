"""
独立数据导入脚本 — 直接指定数据库文件，不受运行服务器影响
"""

import asyncio, sys, os
from pathlib import Path

# 使用新数据库文件，避免被旧进程锁定
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./poetry_space_dev.db"

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# 直接创建引擎，不依赖 config 模块
DB_URL = "sqlite+aiosqlite:///./poetry_space_dev.db"
engine = create_async_engine(DB_URL, echo=False, connect_args={"check_same_thread": False})

from app.core.database import Base
from app.core.compat import utcnow
from app.models.place_name import PlaceName
from app.models.poet import Poet, PoetTrajectory
from app.models.poetry import Poetry, PoetryFeature

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "data"))
from place_names.seed_places import PLACE_SEEDS
from place_names.seed_places_extra import EXTRA_PLACES
from poet_trajectories.seed_poets import POET_SEEDS, TRAJECTORY_SEEDS
from poet_trajectories.seed_poets_extra import EXTRA_POETS
from poetry_features.seed_poetry import POETRY_SEEDS
from poetry_features.seed_poetry_extra import EXTRA_POETRY


async def main():
    print("=" * 50)
    print("  种子数据导入")
    print(f"  数据库: {DB_URL}")
    print("=" * 50)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("\n[init] 表结构创建完成")

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        # ── 1. 地名 ─────────────────────────
        print("\n[1/4] 古今地名...")
        place_map = {}
        for row in PLACE_SEEDS + EXTRA_PLACES:
            n = row[0]
            r = await session.execute(select(PlaceName).where(PlaceName.ancient_name == n))
            p = r.scalar_one_or_none()
            if p:
                place_map[n] = p
                continue
            p = PlaceName(ancient_name=n, modern_name=row[1],
                wgs84_lon=row[2], wgs84_lat=row[3],
                province=row[4], city=row[5], district=row[6],
                admin_level=row[7], source=row[8], created_at=utcnow())
            session.add(p)
            place_map[n] = p
        await session.flush()
        print(f"  地名: {len(place_map)} 条")

        # ── 2. 诗人 ─────────────────────────
        print("\n[2/4] 诗人...")
        poet_map = {}
        for row in POET_SEEDS + EXTRA_POETS:
            r = await session.execute(select(Poet).where(Poet.name == row["name"]))
            p = r.scalar_one_or_none()
            if p:
                poet_map[row["name"]] = p
                continue
            p = Poet(name=row["name"], birth_year=row["birth_year"],
                death_year=row["death_year"], dynasty=row["dynasty"],
                tags=row["tags"], created_at=utcnow())
            session.add(p)
            poet_map[row["name"]] = p
        await session.flush()
        print(f"  诗人: {len(poet_map)} 位")

        # ── 3. 轨迹 ─────────────────────────
        print("\n[3/4] 诗人轨迹...")
        n = 0
        for row in TRAJECTORY_SEEDS:
            poet, year, place_name, lon, lat, evt, stay, src = row
            p = poet_map.get(poet)
            if not p:
                continue
            r = await session.execute(select(PoetTrajectory).where(
                PoetTrajectory.poet_id == p.poet_id,
                PoetTrajectory.event_year == year,
                PoetTrajectory.ancient_place == place_name))
            if r.scalar_one_or_none():
                continue
            pl = place_map.get(place_name)
            t = PoetTrajectory(poet_id=p.poet_id, event_year=year,
                ancient_place=place_name,
                place_id=pl.place_id if pl else None,
                wgs84_lon=lon, wgs84_lat=lat, event_type=evt,
                stay_duration_days=stay, source=src, created_at=utcnow())
            session.add(t)
            n += 1
        await session.flush()
        print(f"  轨迹: {n} 条")

        # ── 4. 诗词 ─────────────────────────
        print("\n[4/4] 诗词+六维度...")
        n = 0
        for row in POETRY_SEEDS + EXTRA_POETRY:
            p = poet_map.get(row["author"])
            if not p:
                continue
            r = await session.execute(select(Poetry).where(
                Poetry.title == row["title"],
                Poetry.author_id == p.poet_id))
            if r.scalar_one_or_none():
                continue
            geo_tags = row.get("geo_tags", [])
            gp = place_map.get(geo_tags[0]) if geo_tags else None
            poem = Poetry(title=row["title"], author_id=p.poet_id,
                dynasty=row["dynasty"], content=row["content"],
                genre=row.get("genre"), created_at=utcnow())
            session.add(poem)
            await session.flush()
            feat = PoetryFeature(poetry_id=poem.poetry_id,
                geo_creation_place_id=gp.place_id if gp else None,
                season=row.get("season", []),
                solar_term=row.get("solar_term", []),
                festival=row.get("festival", []),
                character_names=row.get("character_names", []),
                imagery_items=row.get("imagery_items", []),
                mood_tags=row.get("mood_tags", []),
                allusion_names=row.get("allusion_names", []),
                allusion_sources=row.get("allusion_sources", []))
            session.add(feat)
            n += 1
        await session.flush()
        print(f"  诗词: {n} 首")

        # ── 提交 ─────────────────────────
        await session.commit()

        # ── 统计 ─────────────────────────
        print("\n" + "=" * 50)
        print("  ✅ 数据导入完成！")
        print("=" * 50)
        for model, name in [(PlaceName,"地名"),(Poet,"诗人"),
            (PoetTrajectory,"轨迹"),(Poetry,"诗词"),(PoetryFeature,"标注")]:
            c = (await session.execute(select(func.count()).select_from(model))).scalar()
            print(f"  {name}: {c}")

if __name__ == "__main__":
    asyncio.run(main())
