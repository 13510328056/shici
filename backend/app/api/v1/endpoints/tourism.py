"""
文旅交互模块 API — 路线 / 景点 / 扫码 / 打卡
需求 4.3
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.place_name import PlaceName
from app.models.poetry import Poetry, PoetryFeature
from app.models.poet import Poet

router = APIRouter()

# ─── 预设主题路线 ────────────────────────────
TOUR_ROUTES = [
    {
        "id": "tang_poetry",
        "name": "唐诗之路",
        "description": "从长安到江南，追寻唐代诗人的足迹",
        "color": "#FF6B35",
        "stops": [
            {"place": "长安", "lon": 108.94, "lat": 34.26, "desc": "唐代帝都，诗人汇聚之地"},
            {"place": "洛阳", "lon": 112.45, "lat": 34.62, "desc": "东都，李白杜甫相识于此"},
            {"place": "汴州", "lon": 114.35, "lat": 34.80, "desc": "北宋都城，商贸繁华"},
            {"place": "扬州", "lon": 119.41, "lat": 32.39, "desc": "淮左名都，杜牧十年一觉"},
            {"place": "金陵", "lon": 118.80, "lat": 32.06, "desc": "六朝古都，怀古胜地"},
            {"place": "苏州", "lon": 120.58, "lat": 31.30, "desc": "江南水乡，枫桥夜泊"},
            {"place": "杭州", "lon": 120.15, "lat": 30.28, "desc": "钱塘自古繁华"},
        ],
    },
    {
        "id": "su_dongpo",
        "name": "东坡足迹",
        "description": "跟随苏轼走过的人生之路",
        "color": "#4CAF50",
        "stops": [
            {"place": "眉山", "lon": 103.85, "lat": 30.05, "desc": "苏轼出生地"},
            {"place": "汴京", "lon": 114.35, "lat": 34.80, "desc": "进士及第，名动京师"},
            {"place": "杭州", "lon": 120.15, "lat": 30.28, "desc": "疏浚西湖，筑苏堤"},
            {"place": "黄州", "lon": 114.86, "lat": 30.44, "desc": "贬谪地，写赤壁赋"},
            {"place": "惠州", "lon": 114.41, "lat": 23.11, "desc": "再贬岭南，日啖荔枝"},
            {"place": "儋州", "lon": 109.52, "lat": 19.52, "desc": "天涯海角，最终贬所"},
        ],
    },
    {
        "id": "li_bai",
        "name": "李白漫游",
        "description": "诗仙李白一生的漫游轨迹",
        "color": "#9C27B0",
        "stops": [
            {"place": "碎叶城", "lon": 83.0, "lat": 42.5, "desc": "出生地（今吉尔吉斯斯坦）"},
            {"place": "绵州", "lon": 104.72, "lat": 31.47, "desc": "少年成长地"},
            {"place": "长安", "lon": 108.94, "lat": 34.26, "desc": "供奉翰林，名动天下"},
            {"place": "洛阳", "lon": 112.45, "lat": 34.62, "desc": "遇见杜甫"},
            {"place": "金陵", "lon": 118.80, "lat": 32.06, "desc": "游历江南"},
            {"place": "当涂", "lon": 118.49, "lat": 31.55, "desc": "终老之地"},
        ],
    },
]


@router.get("/routes")
async def list_routes():
    """获取所有预设主题路线"""
    return {"routes": TOUR_ROUTES}


@router.get("/routes/{route_id}")
async def get_route(route_id: str):
    """获取指定路线详情"""
    for r in TOUR_ROUTES:
        if r["id"] == route_id:
            return r
    return {"error": "route not found"}


@router.get("/places/{place_name}/poems")
async def get_place_poems(
    place_name: str,
    db: AsyncSession = Depends(get_db),
):
    """获取与某地相关的诗词"""
    from sqlalchemy import or_

    # 搜索地名
    r = await db.execute(
        select(PlaceName).where(PlaceName.ancient_name.ilike(f"%{place_name}%"))
    )
    place = r.scalar_one_or_none()
    if not place:
        return {"place": place_name, "poems": [], "count": 0}

    # 查找创作于此处或描写此处的诗词
    stmt = (
        select(Poetry)
        .join(PoetryFeature, PoetryFeature.poetry_id == Poetry.poetry_id)
        .where(
            or_(
                PoetryFeature.geo_creation_place_id == place.place_id,
                PoetryFeature.geo_description_place_ids.contains(place_name),
            )
        )
        .limit(20)
    )
    poems = (await db.execute(stmt)).scalars().all()

    results = []
    for poem in poems:
        author = (await db.execute(select(Poet).where(Poet.poet_id == poem.author_id))).scalar_one_or_none()
        results.append({
            "title": poem.title,
            "author": author.name if author else "佚名",
            "content": poem.content[:120] + "…" if len(poem.content) > 120 else poem.content,
            "dynasty": poem.dynasty,
        })

    return {"place": {"ancient_name": place.ancient_name, "modern_name": place.modern_name},
            "poems": results, "count": len(results)}
