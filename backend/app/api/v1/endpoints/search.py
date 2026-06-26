"""
多维检索服务 API — 六维度组合检索
需求依据：4.2 多维诗词聚合检索模块
"""

from typing import Optional

from fastapi import APIRouter, Body

from app.schemas.search import PoetrySearchRequest, PoetrySearchResponse

router = APIRouter()


@router.post("/poetry", response_model=PoetrySearchResponse)
async def search_poetry(
    body: PoetrySearchRequest = Body(...),
):
    """
    六维度组合检索：地理/时间/人物/意象/意境/用典
    需求 4.2.1：支持自由交叉检索
    约束 4.2.2：10万条数据内 ≤500ms
    """
    # TODO: 对接 ES 时空复合索引
    # 当前为 PoC 桩
    return PoetrySearchResponse(
        total=0,
        results=[],
        suggestion="检索服务待对接 ES 索引",
    )
