"""
中国古诗词文化互动平台 — FastAPI 主入口
版本：V0.1 (PoC)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router

app = FastAPI(
    title="PoetrySpace API — 中国古诗词文化互动平台",
    description=(
        "诗词时空可视化 + AI 创作辅助 + 文旅交互"
        " | 后端微服务集群统一入口"
    ),
    version="0.1.0",
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

# 挂载 API 路由
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "version": "0.1.0"}
