"""
时空查询服务 — 单元测试
需求验证：80km 围栏、交游概率、Haversine 距离
"""

import pytest
import math
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.spatial import SpatialQueryService


class TestSpatialQueryService:
    """空间查询服务测试"""

    @pytest.fixture
    def mock_db(self):
        """Mock 数据库会话"""
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db):
        return SpatialQueryService(mock_db)

    def test_haversine_same_point(self, service):
        """同一坐标距离应为 0"""
        dist = service._haversine(116.4, 39.9, 116.4, 39.9)
        assert dist == 0.0

    def test_haversine_known_distance(self, service):
        """北京→上海近似距离 ≈1060km"""
        dist = service._haversine(116.4, 39.9, 121.5, 31.2)
        # 允许 5% 误差
        assert abs(dist - 1060) / 1060 < 0.05

    def test_haversine_antipodal(self, service):
        """对跖点距离 ≈20015km（半圆周长）"""
        dist = service._haversine(0, 0, 0, 90)
        assert abs(dist - 10007) / 10007 < 0.01

    @pytest.mark.asyncio
    async def test_find_places_within_radius(self, service, mock_db):
        """围栏查询正常路径"""
        mock_result = MagicMock()
        mock_result.mappings.return_value.all.return_value = [
            {"place_id": "1", "ancient_name": "长安", "modern_name": "西安",
             "province": "陕西", "city": "西安",
             "wgs84_lon": 108.94, "wgs84_lat": 34.26}
        ]
        mock_db.execute = AsyncMock(return_value=mock_result)

        results = await service.find_places_within_radius(108.9, 34.2)
        assert len(results) == 1
        assert results[0]["ancient_name"] == "长安"

    @pytest.mark.asyncio
    async def test_calculate_encounter_no_overlap(self, service):
        """无交点时交游概率应为 0"""
        with patch.object(service, "get_poet_trajectory") as mock_traj:
            mock_traj.side_effect = [
                [{"event_year": "725"}],
                [{"event_year": "825"}],
            ]
            result = await service.calculate_encounter_probability("a", "b")
            assert result["probability"] == 0
