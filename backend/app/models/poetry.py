"""
诗词多维特征标注数据库 — SQLAlchemy 模型
需求依据：3.2.3 诗词多维特征标注数据库（六维度标注）
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, SmallInteger,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.core.database import Base


class Poetry(Base):
    """诗词作品基础信息表"""
    __tablename__ = "poetry"

    poetry_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("poets.poet_id"), nullable=False)
    dynasty = Column(String(30), nullable=False)
    content = Column(Text, nullable=False, comment="诗词正文")
    genre = Column(String(30), comment="体裁：五绝/七律/词牌名/古风")
    rhythm_pattern = Column(String(100), comment="平仄格式")
    rhyme_category = Column(String(30), comment="韵部")
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("Poet", back_populates="poems")
    features = relationship("PoetryFeature", uselist=False, back_populates="poem")


class PoetryFeature(Base):
    """诗词六维度标注表 — 需求 3.2.3 强制六维度"""
    __tablename__ = "poetry_features"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poetry_id = Column(UUID(as_uuid=True), ForeignKey("poetry.poetry_id"), nullable=False, unique=True)

    # 维度1: 地理特征
    geo_creation_place_id = Column(UUID(as_uuid=True), ForeignKey("place_names.place_id"))
    geo_description_place_ids = Column(ARRAY(UUID), comment="描写地点ID列表")

    # 维度2: 时间特征
    creation_year = Column(String(20))
    season = Column(ARRAY(String(5)), comment="四季：春/夏/秋/冬")
    solar_term = Column(ARRAY(String(20)), comment="二十四节气")
    festival = Column(ARRAY(String(50)), comment="传统节日")

    # 维度3: 人物特征
    character_names = Column(ARRAY(String(100)), comment="描写人物/典故人物")

    # 维度4: 物品意象特征
    imagery_items = Column(ARRAY(String(50)), comment="自然景物/建筑/器物意象")

    # 维度5: 意境特征
    mood_tags = Column(ARRAY(String(30)), comment="送别/思乡/边塞/田园/怀古/登临/闺怨")

    # 维度6: 用典特征
    allusion_names = Column(ARRAY(String(100)), comment="典故名称")
    allusion_sources = Column(ARRAY(String(200)), comment="典故出处")
    allusion_targets = Column(ARRAY(String(100)), comment="典故指代对象")

    poem = relationship("Poetry", back_populates="features")
