"""
AI 辅助服务 — 请求/响应 Schema
需求 4.4：AI 全链路诗词创作辅助
"""

from typing import Optional
from pydantic import BaseModel, Field


class AntithesisRequest(BaseModel):
    """对仗推荐请求"""
    input_text: str = Field(..., description="当前输入文本")
    position: Optional[str] = Field(None, description="对仗位置：出句/对句")
    genre: Optional[str] = Field(None, description="体裁：五律/七律/排律")
    mood_tag: Optional[str] = Field(None, description="意境过滤")


class AntithesisCandidate(BaseModel):
    """对仗推荐候选"""
    word: str
    category: str = Field(..., description="工对/宽对/流水对")
    genre_compat: list[str] = Field(default_factory=list, description="适配体裁")
    example_sentence: Optional[str] = Field(None, description="历代经典例句")
    score: float = 0.0


class AntithesisResponse(BaseModel):
    """对仗推荐响应"""
    input_text: str
    candidates: list[AntithesisCandidate] = []
    suggestion: Optional[str] = None


class RhythmCheckRequest(BaseModel):
    """格律校验请求"""
    content: str = Field(..., description="待校验诗词内容")
    genre: str = Field(..., description="体裁：七绝/七律/五绝/五律/词牌名")
    rhyme_system: str = Field("平水韵", description="韵系：平水韵/中华新韵")


class RhythmError(BaseModel):
    """格律错误项"""
    position: int
    char: str
    error_type: str = Field(..., description="平仄失调/出韵/失粘/失对")
    expected: str
    suggestions: list[str] = []


class RhythmCheckResponse(BaseModel):
    """格律校验响应"""
    content: str
    errors: list[RhythmError] = []
    passed: bool = True
    suggestion: Optional[str] = None
