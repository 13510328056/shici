"""
为缺少轨迹数据的诗人生成基础轨迹
"""

import asyncio, sys, os, random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./poetry_space_dev.db"

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

DB_URL = "sqlite+aiosqlite:///./poetry_space_dev.db"
engine = create_async_engine(DB_URL, echo=False, connect_args={"check_same_thread": False})

from app.models.poet import Poet, PoetTrajectory
from app.models.place_name import PlaceName
from app.core.compat import utcnow


# ─── 基础事件模板 ──────────────────────────
# 为不同身份标签的诗人设置默认轨迹
DEFAULT_EVENTS: dict[str, list[tuple[str, str, str]]] = {
    'default': [
        ('出生', '出生', '长安'),
        ('科举', '科举', '长安'),
        ('仕宦', '仕宦', '长安'),
        ('创作', '创作', '洛阳'),
        ('创作', '创作', '长安'),
    ],
    '山水田园': [
        ('出生', '出生', '长安'),
        ('游览', '游览', '辋川'),
        ('游览', '游览', '终南山'),
        ('创作', '创作', '襄阳'),
        ('创作', '创作', '鹿门山'),
    ],
    '边塞诗派': [
        ('出生', '出生', '长安'),
        ('游览', '游览', '凉州'),
        ('仕宦', '仕宦', '蓟北'),
        ('创作', '创作', '凉州'),
        ('创作', '创作', '居延'),
    ],
    '婉约派': [
        ('出生', '出生', '钱塘'),
        ('科举', '科举', '开封'),
        ('仕宦', '仕宦', '杭州'),
        ('创作', '创作', '杭州'),
        ('创作', '创作', '西湖'),
    ],
    '豪放派': [
        ('出生', '出生', '济南'),
        ('仕宦', '仕宦', '开封'),
        ('仕宦', '仕宦', '密州'),
        ('创作', '创作', '黄州'),
        ('创作', '创作', '杭州'),
    ],
    '爱国': [
        ('出生', '出生', '开封'),
        ('仕宦', '仕宦', '建康'),
        ('仕宦', '仕宦', '临安'),
        ('创作', '创作', '扬州'),
        ('创作', '创作', '金陵'),
    ],
    '女诗人': [
        ('出生', '出生', '成都'),
        ('创作', '创作', '成都'),
        ('创作', '创作', '锦城'),
        ('创作', '创作', '浣花溪'),
    ],
    '诗僧': [
        ('出生', '出生', '庐山'),
        ('游览', '游览', '庐山'),
        ('创作', '创作', '庐山'),
        ('创作', '创作', '杭州'),
    ],
    '政治家': [
        ('出生', '出生', '长安'),
        ('科举', '科举', '长安'),
        ('仕宦', '仕宦', '长安'),
        ('仕宦', '仕宦', '洛阳'),
        ('创作', '创作', '长安'),
    ],
}

# ─── 江南诗人默认轨迹 ─────────────────────
SOUTHERN_EVENTS = [
    ('出生', '出生', '金陵'),
    ('科举', '科举', '长安'),
    ('仕宦', '仕宦', '杭州'),
    ('创作', '创作', '苏州'),
    ('创作', '创作', '扬州'),
]


async def main():
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        poets = (await session.execute(select(Poet))).scalars().all()
        place_names = (await session.execute(select(PlaceName))).scalars().all()
        place_map = {p.ancient_name: p for p in place_names}

        total_new = 0
        count_poets = 0

        for poet in poets:
            existing = (await session.execute(
                select(func.count()).select_from(PoetTrajectory).where(PoetTrajectory.poet_id == poet.poet_id)
            )).scalar()

            if existing > 0:
                continue

            count_poets += 1
            tags = poet.tags or []
            template_key = 'default'
            for tag in tags:
                if tag in DEFAULT_EVENTS:
                    template_key = tag
                    break

            template = DEFAULT_EVENTS.get(template_key, DEFAULT_EVENTS['default'])

            birth_str = poet.birth_year or ''
            death_str = poet.death_year or ''
            try:
                birth_year = int(birth_str) if birth_str.lstrip('-').isdigit() else 700
            except:
                birth_year = 700
            try:
                death_year = int(death_str) if death_str.lstrip('-').isdigit() else 800
            except:
                death_year = 800
            span = max(1, death_year - birth_year)

            for i, (evt_type, evt_subtype, place_name) in enumerate(template):
                year = birth_year + int(span * (i + 0.5) / len(template))
                place = place_map.get(place_name)

                traj = PoetTrajectory(
                    poet_id=poet.poet_id,
                    event_year=str(year),
                    ancient_place=place_name,
                    place_id=place.place_id if place else None,
                    wgs84_lon=place.wgs84_lon if place else (116.4 + random.random()),
                    wgs84_lat=place.wgs84_lat if place else (34.0 + random.random()),
                    event_type=evt_type,
                    stay_duration_days=random.randint(30, 365),
                    source='数据扩充（自动生成）',
                    created_at=utcnow(),
                )
                session.add(traj)
                total_new += 1

        await session.commit()
        print(f"  为 {count_poets} 位诗人生成 {total_new} 条轨迹")

    async with Session() as session2:
        total = (await session2.execute(select(func.count()).select_from(PoetTrajectory))).scalar()
        print(f"  轨迹总数: {total}")

if __name__ == "__main__":
    asyncio.run(main())
