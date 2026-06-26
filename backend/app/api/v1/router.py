"""
API v1 路由聚合
"""

from fastapi import APIRouter

from app.api.v1.endpoints import places, poets, search, ai

api_router = APIRouter()

# 地名映射服务
api_router.include_router(places.router, prefix="/places", tags=["地名映射"])

# 时空可视化服务
api_router.include_router(poets.router, prefix="/poets", tags=["诗人轨迹"])

# 多维检索服务
api_router.include_router(search.router, prefix="/search", tags=["多维检索"])

# AI 服务（预留）
api_router.include_router(ai.router, prefix="/ai", tags=["AI 辅助"])
