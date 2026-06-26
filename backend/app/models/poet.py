"""
诗人轨迹时空数据库 — SQLAlchemy 模型
需求依据：3.2.2 诗人生平轨迹时空数据库
"""

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import (
    Column, String, Integer, Float, Text, DateTime, Enum as SAEnum,
    ForeignKey, SmallInteger, Numeric, Index,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.core.database import Base

import enum


class EventType(str, enum.Enum):
    """诗人活动类型 — 需求 3.2.2 标准化枚举"""
    BIRTH = "出生"
    EXAMINATION = "科举"
    OFFICIAL = "仕宦"
    EXILE = "贬谪"
    TRAVEL = "游览"
    CREATION = "创作"
    GATHERING = "雅集"


class Poet(Base):
    """诗人基础信息表"""
    __tablename__ = "poets"

    poet_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False, index=True)
    birth_year = Column(String(20), comment="出生年份（含'约'前缀）")
    death_year = Column(String(20), comment="去世年份")
    dynasty = Column(String(30), nullable=False, index=True, comment="朝代")
    tags = Column(ARRAY(String), comment="身份标签数组")
    created_at = Column(DateTime, default=datetime.utcnow)

    trajectories = relationship("PoetTrajectory", back_populates="poet")
    poems = relationship("Poetry", back_populates="author")


class PoetTrajectory(Base):
    """诗人时空轨迹事件表 — 核心轨迹数据"""
    __tablename__ = "poet_trajectories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poet_id = Column(UUID(as_uuid=True), ForeignKey("poets.poet_id"), nullable=False)
    event_year = Column(String(20), nullable=False, comment="事件年份")
    event_date_precision = Column(String(10), default="年", comment="精确度：年/月/日")
    ancient_place = Column(String(100), comment="古地名")
    place_id = Column(UUID(as_uuid=True), ForeignKey("place_names.place_id"), comment="关联地名ID")
    wgs84_lon = Column(Float(precision=6))
    wgs84_lat = Column(Float(precision=6))
    geog = Column(Geography(geometry_type="POINT", srid=4326))
    event_type = Column(String(30), nullable=False, comment="活动类型枚举")
    stay_duration_days = Column(Integer, comment="停留天数(估计)")
    source = Column(String(100), comment="数据来源")
    created_at = Column(DateTime, default=datetime.utcnow)

    poet = relationship("Poet", back_populates="trajectories")

    __table_args__ = (
        Index("idx_trajectory_geog", geog, postgresql_using="gist"),
        Index("idx_trajectory_poet_year", poet_id, event_year),
        Index("idx_trajectory_type", event_type),
    )


class PoetEncounter(Base):
    """诗人交游关联表 — 预计算，支撑交游概率查询"""
    __tablename__ = "poet_encounters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poet_a_id = Column(UUID(as_uuid=True), ForeignKey("poets.poet_id"), nullable=False)
    poet_b_id = Column(UUID(as_uuid=True), ForeignKey("poets.poet_id"), nullable=False)
    overlap_start_year = Column(String(20))
    overlap_end_year = Column(String(20))
    overlap_lon = Column(Float(precision=6), comment="重叠区域中心经度")
    overlap_lat = Column(Float(precision=6), comment="重叠区域中心纬度")
    encounter_probability = Column(Numeric(5, 4), comment="交游概率 P (0-1)")
    period_overlap_days = Column(Integer, comment="重叠时间(天)")
    area_overlap_km2 = Column(Numeric(10, 2), comment="重叠面积(km²)")
    related_poetry_ids = Column(ARRAY(UUID), comment="关联诗词ID列表")
    created_at = Column(DateTime, default=datetime.utcnow)
