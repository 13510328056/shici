"""
API 集成测试 — 健康检查 + 核心端点
"""
import uuid
import pytest
from sqlalchemy import select, insert

from app.models.poet import Poet
from app.models.place_name import PlaceName
from app.models.poetry import Poetry, PoetryFeature


@pytest.mark.asyncio
async def test_health_check(async_client):
    """健康检查端点应返回 ok"""
    resp = await async_client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


@pytest.mark.asyncio
async def test_list_poets_empty(async_client):
    """诗人列表为空时应返回空数组"""
    resp = await async_client.get("/api/v1/poets")
    assert resp.status_code == 200
    data = resp.json()
    assert data["poets"] == []


@pytest.mark.asyncio
async def test_list_poets_with_data(async_client, test_db):
    """插入诗人后列表应正确返回"""
    pid = str(uuid.uuid4())
    await test_db.execute(
        insert(Poet).values(
            poet_id=pid,
            name="测试诗人",
            dynasty="唐",
            birth_year="700",
            death_year="760",
        )
    )
    await test_db.commit()

    resp = await async_client.get("/api/v1/poets")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["poets"]) == 1
    assert data["poets"][0]["name"] == "测试诗人"


@pytest.mark.asyncio
async def test_search_places(async_client, test_db):
    """地名搜索应支持模糊匹配"""
    pid = str(uuid.uuid4())
    await test_db.execute(
        insert(PlaceName).values(
            place_id=pid,
            ancient_name="长安",
            modern_name="西安",
            wgs84_lon=108.94,
            wgs84_lat=34.26,
            province="陕西",
            city="西安",
        )
    )
    await test_db.commit()

    resp = await async_client.get("/api/v1/places/search", params={"q": "长安"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 1
    assert any(r["ancient_name"] == "长安" for r in data["results"])


@pytest.mark.asyncio
async def test_search_places_no_result(async_client):
    """地名搜索无匹配时应返回空"""
    resp = await async_client.get("/api/v1/places/search", params={"q": "不存在的_地名_xyz"})
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


@pytest.mark.asyncio
async def test_get_poet_trajectory(async_client, test_db):
    """获取诗人轨迹"""
    pid = str(uuid.uuid4())
    await test_db.execute(
        insert(Poet).values(poet_id=pid, name="李白", dynasty="唐")
    )
    await test_db.commit()

    resp = await async_client.get(f"/api/v1/poets/{pid}/trajectory")
    assert resp.status_code == 200
    data = resp.json()
    assert data["poet_id"] == pid


@pytest.mark.asyncio
async def test_get_poet_poetry(async_client, test_db):
    """获取诗人的作品列表"""
    pid = str(uuid.uuid4())
    poetry_id = str(uuid.uuid4())
    await test_db.execute(
        insert(Poet).values(poet_id=pid, name="杜甫", dynasty="唐")
    )
    await test_db.execute(
        insert(Poetry).values(
            poetry_id=poetry_id,
            title="春望",
            author_id=pid,
            dynasty="唐",
            content="国破山河在，城春草木深。",
            genre="五律",
        )
    )
    await test_db.execute(
        insert(PoetryFeature).values(
            id=str(uuid.uuid4()),
            poetry_id=poetry_id,
            mood_tags='["忧国"]',
            imagery_items='["山河","草木"]',
        )
    )
    await test_db.commit()

    resp = await async_client.get(f"/api/v1/poets/{pid}/poetry")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["poems"][0]["title"] == "春望"


@pytest.mark.asyncio
async def test_unified_search(async_client, test_db):
    """统一搜索应同时返回诗人和诗词"""
    pid = str(uuid.uuid4())
    poetry_id = str(uuid.uuid4())
    await test_db.execute(
        insert(Poet).values(poet_id=pid, name="白居易", dynasty="唐")
    )
    await test_db.execute(
        insert(Poetry).values(
            poetry_id=poetry_id,
            title="琵琶行",
            author_id=pid,
            dynasty="唐",
            content="座中泣下谁最多，江州司马青衫湿。",
            genre="古风",
        )
    )
    await test_db.execute(
        insert(PoetryFeature).values(
            id=str(uuid.uuid4()),
            poetry_id=poetry_id,
        )
    )
    await test_db.commit()

    # 搜索诗人名 — 应匹配诗人"白居易"
    resp = await async_client.get("/api/v1/search/all", params={"keyword": "白居易"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["poets"]) >= 1
    assert any(p["name"] == "白居易" for p in data["poets"])

    # 搜索诗词内容 — 应匹配诗句含"司马"的诗词
    resp2 = await async_client.get("/api/v1/search/all", params={"keyword": "司马"})
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["poems"]) >= 1


@pytest.mark.asyncio
async def test_export_places_csv(async_client):
    """导出地名 CSV 应成功"""
    resp = await async_client.get("/api/v1/export/places", params={"format": "csv"})
    assert resp.status_code == 200
    assert resp.headers.get("content-type", "").startswith("text/csv")


@pytest.mark.asyncio
async def test_cors_headers(async_client):
    """CORS 头应正确设置"""
    resp = await async_client.options(
        "/health",
        headers={
            "Origin": "http://localhost:15173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" in resp.headers
