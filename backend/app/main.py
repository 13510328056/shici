"""
中国古诗词文化互动平台 — FastAPI 主入口
版本：V0.1 (PoC)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.v1.router import api_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期 — 启动时自动填充种子数据（空数据库时）"""
    try:
        from sqlalchemy import select, func
        from app.core.database import async_session_factory, engine, Base
        from app.models.poet import Poet

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with async_session_factory() as session:
            count = (await session.execute(select(func.count()).select_from(Poet))).scalar()
            if count == 0:
                logger.info("🔄 数据库为空，自动导入种子数据...")
                # 复用 manage.py 的 seed 逻辑
                from app.core.compat import utcnow
                from app.models.place_name import PlaceName
                from app.models.poet import PoetTrajectory
                from app.models.poetry import Poetry, PoetryFeature

                from pathlib import Path
                import sys
                data_dir = str(Path(__file__).parent.parent.parent / "data")
                if data_dir not in sys.path:
                    sys.path.insert(0, data_dir)
                from place_names.seed_places import PLACE_SEEDS
                from place_names.seed_places_extra import EXTRA_PLACES
                from poet_trajectories.seed_poets import POET_SEEDS, TRAJECTORY_SEEDS
                from poet_trajectories.seed_poets_extra import EXTRA_POETS
                from poetry_features.seed_poetry import POETRY_SEEDS
                from poetry_features.seed_poetry_extra import EXTRA_POETRY

                place_map = {}
                for row in PLACE_SEEDS + EXTRA_PLACES:
                    pn = row[0]
                    r = await session.execute(select(PlaceName).where(PlaceName.ancient_name == pn))
                    p = r.scalar_one_or_none()
                    if not p:
                        p = PlaceName(ancient_name=pn, modern_name=row[1],
                            wgs84_lon=row[2], wgs84_lat=row[3],
                            province=row[4], city=row[5], district=row[6],
                            admin_level=row[7], source=row[8], created_at=utcnow())
                        session.add(p)
                        await session.flush()
                    place_map[pn] = p

                poet_map = {}
                for row in POET_SEEDS + EXTRA_POETS:
                    r = await session.execute(select(Poet).where(Poet.name == row["name"]))
                    p = r.scalar_one_or_none()
                    if not p:
                        p = Poet(name=row["name"], birth_year=row["birth_year"],
                            death_year=row["death_year"], dynasty=row["dynasty"],
                            tags=row["tags"], created_at=utcnow())
                        session.add(p)
                        await session.flush()
                    poet_map[row["name"]] = p

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

                await session.commit()
                logger.info("✅ 种子数据导入完成！")

            # 自动迁移 + 难度填充
            try:
                from sqlalchemy import text as sa_text
                pragma = await session.execute(sa_text("PRAGMA table_info(poetry_features)"))
                cols = {row[1] for row in pragma.fetchall()}
                if "difficulty" not in cols:
                    await session.execute(sa_text("ALTER TABLE poetry_features ADD COLUMN difficulty VARCHAR(10)"))
                    await session.commit()
                    logger.info("✅ 添加 difficulty 列成功")
            except Exception as e:
                await session.rollback()
                logger.info("difficulty 列迁移: %s", e)

            # 填充诗词难度分级
            from app.services.daily_scheduler import seed_difficulty
            await seed_difficulty(session)
            await session.commit()
            await session.close()
            logger.info("✅ 诗词难度分级填充完成，种子会话已关闭")
    except Exception as e:
        logger.warning("自动种子数据导入失败（首次启动可忽略）: %s", e)

    yield


app = FastAPI(
    title="PoetrySpace API — 中国古诗词文化互动平台",
    description=(
        "诗词时空可视化 + AI 创作辅助 + 文旅交互"
        " | 后端微服务集群统一入口"
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.ENV != "production" else None,
    redoc_url="/api/redoc" if settings.ENV != "production" else None,
)

# CORS — 多终端（PC/App/小程序）跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局异常处理器 — 标准化 JSON 错误响应
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "内部服务器错误",
            "detail": str(exc) if settings.ENV != "production" else "请联系管理员",
            "path": str(request.url),
        },
    )


# 挂载 API 路由
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "version": "0.1.0"}
