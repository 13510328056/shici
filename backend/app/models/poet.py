"""
诗人轨迹时空数据库 — SQLAlchemy 模型
需求依据：3.2.2 诗人生平轨迹时空数据库
"""

import enum

from sqlalchemy import (
    Column, String, Integer, Float, DateTime,
    ForeignKey, SmallInteger, Numeric, Index,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.compat import (
    UUIDColumn, FKColumn, ArrayColumn, GeoPointColumn,
    utcnow, supports_geography,
)


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

    poet_id = UUIDColumn()
    name = Column(String(50), nullable=False, index=True)
    birth_year = Column(String(20), comment="出生年份（含'约'前缀）")
    death_year = Column(String(20), comment="去世年份")
    dynasty = Column(String(30), nullable=False, index=True)
    tags = ArrayColumn(comment="身份标签数组")
    created_at = Column(DateTime, default=utcnow)

    trajectories = relationship("PoetTrajectory", back_populates="poet")
    poems = relationship("Poetry", back_populates="author")


class PoetTrajectory(Base):
    """诗人时空轨迹事件表 — 核心轨迹数据"""
    __tablename__ = "poet_trajectories"

    id = UUIDColumn()
    poet_id = FKColumn(ForeignKey("poets.poet_id"), nullable=False)
    event_year = Column(String(20), nullable=False, comment="事件年份")
    event_date_precision = Column(String(10), default="年")
    ancient_place = Column(String(100))
    place_id = FKColumn(ForeignKey("place_names.place_id"))
    wgs84_lon = Column(Float(precision=6))
    wgs84_lat = Column(Float(precision=6))
    geog = GeoPointColumn(nullable=True)
    event_type = Column(String(30), nullable=False)
    stay_duration_days = Column(Integer)
    source = Column(String(100))
    created_at = Column(DateTime, default=utcnow)

    poet = relationship("Poet", back_populates="trajectories")

    __table_args__ = (
        Index("idx_trajectory_poet_year", "poet_id", "event_year"),
        Index("idx_trajectory_type", "event_type"),
    )


class PoetEncounter(Base):
    """诗人交游关联表 — 预计算"""
    __tablename__ = "poet_encounters"

    id = UUIDColumn()
    poet_a_id = FKColumn(ForeignKey("poets.poet_id"), nullable=False)
    poet_b_id = FKColumn(ForeignKey("poets.poet_id"), nullable=False)
    overlap_start_year = Column(String(20))
    overlap_end_year = Column(String(20))
    overlap_lon = Column(Float(precision=6))
    overlap_lat = Column(Float(precision=6))
    encounter_probability = Column(Numeric(5, 4))
    period_overlap_days = Column(Integer)
    area_overlap_km2 = Column(Numeric(10, 2))
    related_poetry_ids = ArrayColumn()
    created_at = Column(DateTime, default=utcnow)
