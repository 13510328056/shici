"""
诗词多维特征标注数据库 — SQLAlchemy 模型
需求依据：3.2.3 诗词多维特征标注数据库（六维度标注）
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.compat import UUIDColumn, FKColumn, ArrayColumn, utcnow


class Poetry(Base):
    """诗词作品基础信息表"""
    __tablename__ = "poetry"

    poetry_id = UUIDColumn()
    title = Column(String(200), nullable=False)
    author_id = FKColumn(ForeignKey("poets.poet_id"), nullable=False)
    dynasty = Column(String(30), nullable=False)
    content = Column(Text, nullable=False, comment="诗词正文")
    genre = Column(String(30), comment="体裁：五绝/七律/词牌名/古风")
    rhythm_pattern = Column(String(100), comment="平仄格式")
    rhyme_category = Column(String(30), comment="韵部")
    created_at = Column(DateTime, default=utcnow)

    author = relationship("Poet", back_populates="poems")
    features = relationship("PoetryFeature", uselist=False, back_populates="poem")


class PoetryFeature(Base):
    """诗词六维度标注表 — 需求 3.2.3 强制六维度"""
    __tablename__ = "poetry_features"

    id = UUIDColumn()
    poetry_id = FKColumn(ForeignKey("poetry.poetry_id"), nullable=False, unique=True)

    # 维度1: 地理特征
    geo_creation_place_id = FKColumn(ForeignKey("place_names.place_id"))
    geo_description_place_ids = ArrayColumn(comment="描写地点ID列表")

    # 维度2: 时间特征
    creation_year = Column(String(20))
    season = ArrayColumn(comment="四季：春/夏/秋/冬")
    solar_term = ArrayColumn(comment="二十四节气")
    festival = ArrayColumn(comment="传统节日")

    # 维度3: 人物特征
    character_names = ArrayColumn(comment="描写人物/典故人物")

    # 维度4: 物品意象特征
    imagery_items = ArrayColumn(comment="自然景物/建筑/器物意象")

    # 维度5: 意境特征
    mood_tags = ArrayColumn(comment="送别/思乡/边塞/田园/怀古/登临/闺怨")

    # 维度6: 用典特征
    allusion_names = ArrayColumn(comment="典故名称")
    allusion_sources = ArrayColumn(comment="典故出处")
    allusion_targets = ArrayColumn(comment="典故指代对象")

    # 难度分级（SRS 3.1 优先级4：难度均衡调控）
    difficulty = Column(String(10), comment="难度：L1入门/L2进阶/L3深度")

    poem = relationship("Poetry", back_populates="features")


class DailyPoemLog(Base):
    """每日诗词推送记录 — SRS 3.1 智能推荐日志"""
    __tablename__ = "daily_poem_log"

    id = UUIDColumn()
    date = Column(String(20), nullable=False, unique=True, comment="日期 YYYY-MM-DD")
    poetry_id = FKColumn(ForeignKey("poetry.poetry_id"), nullable=False)
    reason = Column(String(50), comment="推荐理由：节日/节气/季节/专题/均衡")
    priority = Column(Integer, comment="命中优先级 1-5")
    created_at = Column(DateTime, default=utcnow)

    poem = relationship("Poetry")
