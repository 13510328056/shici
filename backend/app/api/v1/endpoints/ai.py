"""
AI 诗词辅助服务 API — 对仗/格律/文本生成
需求依据：4.4 AI 全链路诗词创作辅助模块
"""

from fastapi import APIRouter, Body

from app.schemas.ai import (
    AntithesisRequest, AntithesisResponse,
    RhythmCheckRequest, RhythmCheckResponse,
)
from app.services.antithesis import AntithesisService
from app.services.mood_matching import MoodMatchingService

router = APIRouter()

@router.post("/mood/generate")
async def generate_mood(
    body: dict = Body(...),
):
    """
    意境匹配创作 — 需求 4.4.2
    选意境→自动生成创作框架+推荐意象+写作指引
    """
    service = MoodMatchingService()
    result = await service.generate(
        mood_tag=body.get('mood_tag', '山水'),
        season=body.get('season'),
        location=body.get('location'),
        level=body.get('level', '入门'),
        genre=body.get('genre', '七绝'),
    )
    return result



@router.post("/antithesis/recommend")
async def recommend_antithesis(
    body: AntithesisRequest = Body(...),
):
    """
    对仗词汇推荐 — 需求 4.4.1
    基于语义分类+平仄相对规则引擎，实时推荐 ≤50ms
    """
    service = AntithesisService()
    result = await service.recommend(
        input_text=body.input_text,
        position=body.position,
        genre=body.genre,
        mood_tag=body.mood_tag,
    )
    return result


@router.post("/rhythm/check")
async def check_rhythm(
    body: RhythmCheckRequest = Body(...),
):
    """
    格律校验 — 需求 4.4.3
    双韵库（平水韵/中华新韵），全体裁覆盖
    """
    service = AntithesisService()
    result = await service.check_rhythm(
        content=body.content,
        genre=body.genre,
        rhyme_system=body.rhyme_system,
    )
    return result
