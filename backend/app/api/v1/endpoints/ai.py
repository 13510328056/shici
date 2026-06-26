"""
AI 诗词辅助服务 API — 对仗/格律/文本生成
需求依据：4.4 AI 全链路诗词创作辅助模块
"""

from fastapi import APIRouter, Body

from app.schemas.ai import (
    AntithesisRequest, AntithesisResponse,
    RhythmCheckRequest, RhythmCheckResponse,
)

router = APIRouter()


@router.post("/antithesis/recommend", response_model=AntithesisResponse)
async def recommend_antithesis(
    body: AntithesisRequest = Body(...),
):
    """
    对仗词汇推荐 — 需求 4.4.1
    基于 265万组对仗词库，实时推荐 ≤500ms
    """
    # TODO: 对接对仗词库引擎
    return AntithesisResponse(
        input_text=body.input_text,
        candidates=[],
        suggestion="对仗推荐服务待对接词库引擎",
    )


@router.post("/rhythm/check", response_model=RhythmCheckResponse)
async def check_rhythm(
    body: RhythmCheckRequest = Body(...),
):
    """
    格律校验 — 需求 4.4.3
    双韵库（平水韵/中华新韵），全体裁覆盖 ≤500ms
    """
    # TODO: 对接格律校验引擎
    return RhythmCheckResponse(
        content=body.content,
        errors=[],
        suggestion="格律校验服务待对接",
    )
