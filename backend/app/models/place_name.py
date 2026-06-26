"""
古今地名映射数据库 — SQLAlchemy 模型
需求依据：3.2.1 古今地名映射数据库
"""

from sqlalchemy import (
    Column, String, Float, DateTime, ForeignKey,
    SmallInteger, Index,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.compat import (
    UUIDColumn, FKColumn, ArrayColumn, GeoPointColumn,
    utcnow,
)


class PlaceName(Base):
    """古今地名映射表 — 核心表"""
    __tablename__ = "place_names"

    place_id = UUIDColumn()
    ancient_name = Column(String(100), nullable=False, index=True)
    modern_name = Column(String(100), nullable=False, index=True)
    wgs84_lon = Column(Float(precision=6), nullable=False)
    wgs84_lat = Column(Float(precision=6), nullable=False)
    province = Column(String(50))
    city = Column(String(50))
    district = Column(String(50))
    admin_level = Column(SmallInteger, comment="1=省 2=市 3=县")
    geog = GeoPointColumn(nullable=True)  # PostGIS 空间字段（仅 PG 生效）
    source = Column(String(100))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    name_changes = relationship("PlaceNameChange", back_populates="place")
    ambiguity_rules = relationship("PlaceAmbiguityRule", back_populates="place")

    __table_args__ = ()
    # 注：PostGIS GIST 空间索引在生产环境手动创建：
    # CREATE INDEX idx_place_names_geog ON place_names USING GIST (geog);


class PlaceNameChange(Base):
    """地名沿革变更记录 — 时间线"""
    __tablename__ = "place_name_changes"

    id = UUIDColumn()
    place_id = FKColumn(ForeignKey("place_names.place_id"), nullable=False)
    change_year = Column(String(10), comment="变更年份（含'约''前'等）")
    old_name = Column(String(100))
    new_name = Column(String(100))
    source = Column(String(100), comment="史料来源")

    place = relationship("PlaceName", back_populates="name_changes")


class PlaceAmbiguityRule(Base):
    """歧义地名处理规则表"""
    __tablename__ = "place_ambiguity_rules"

    id = UUIDColumn()
    ambiguous_name = Column(String(100), nullable=False, comment="歧义地名")
    target_place_id = FKColumn(ForeignKey("place_names.place_id"), nullable=False)
    dynasty_filter = Column(String(50), comment="朝代过滤条件")
    context_keywords = ArrayColumn(comment="语境关键词")
    priority = Column(SmallInteger, default=0, comment="匹配优先级")

    place = relationship("PlaceName", back_populates="ambiguity_rules")
