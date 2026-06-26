"""
古今地名映射数据库 — SQLAlchemy 模型
需求依据：3.2.1 古今地名映射数据库
"""

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import (
    Column, String, Integer, Float, Text, DateTime, Enum, ForeignKey,
    SmallInteger, Index,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.core.database import Base


class PlaceName(Base):
    """古今地名映射表 — 核心表"""
    __tablename__ = "place_names"

    place_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ancient_name = Column(String(100), nullable=False, index=True)       # 古地名
    modern_name = Column(String(100), nullable=False, index=True)        # 现地名
    wgs84_lon = Column(Float(precision=6), nullable=False)               # WGS84 经度
    wgs84_lat = Column(Float(precision=6), nullable=False)               # WGS84 纬度
    province = Column(String(50))                                        # 省
    city = Column(String(50))                                            # 市
    district = Column(String(50))                                        # 区县
    admin_level = Column(SmallInteger, comment="1=省 2=市 3=县")          # 行政区划级别
    geog = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)  # PostGIS 空间字段
    source = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联
    name_changes = relationship("PlaceNameChange", back_populates="place")
    ambiguity_rules = relationship("PlaceAmbiguityRule", back_populates="place")

    __table_args__ = (
        Index("idx_place_names_geog", geog, postgresql_using="gist"),
        Index("idx_place_names_ancient", ancient_name, postgresql_using="gin"),
    )


class PlaceNameChange(Base):
    """地名沿革变更记录 — 时间线"""
    __tablename__ = "place_name_changes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    place_id = Column(UUID(as_uuid=True), ForeignKey("place_names.place_id"), nullable=False)
    change_year = Column(String(10), comment="变更年份（含'约''前'等）")
    old_name = Column(String(100))
    new_name = Column(String(100))
    source = Column(String(100), comment="史料来源")

    place = relationship("PlaceName", back_populates="name_changes")


class PlaceAmbiguityRule(Base):
    """歧义地名处理规则表"""
    __tablename__ = "place_ambiguity_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ambiguous_name = Column(String(100), nullable=False, comment="歧义地名")
    target_place_id = Column(UUID(as_uuid=True), ForeignKey("place_names.place_id"), nullable=False)
    dynasty_filter = Column(String(50), comment="朝代过滤条件")
    context_keywords = Column(ARRAY(String), comment="语境关键词")
    priority = Column(SmallInteger, default=0, comment="匹配优先级")

    place = relationship("PlaceName", back_populates="ambiguity_rules")
