"""
数据库兼容层 — 根据后端类型（SQLite / PostgreSQL）提供正确的列类型

开发环境（SQLite）：简化类型
生产环境（PostgreSQL）：完整 PostGIS + ARRAY + UUID 支持
"""

import uuid as _uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY

from app.core.database import is_postgres


def utcnow():
    """兼容 Python 3.12+ 的 UTC now"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ─── UUID 列 ─────────────────────────────────────────

class GUID(TypeDecorator):
    """跨数据库 UUID 类型：PostgreSQL 原生 UUID，SQLite 用 String(36)"""
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value  # PG 原生 UUID 类型
        return str(value)  # SQLite 存字符串

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, _uuid.UUID):
            return value
        return _uuid.UUID(value)


def UUIDColumn(**kwargs):
    """返回跨数据库 UUID 列"""
    kwargs.setdefault("default", _uuid.uuid4)
    return Column(GUID(), primary_key=True, **kwargs)


def FKColumn(*args, **kwargs):
    """返回外键 UUID 列（带索引）
    用法: FKColumn(ForeignKey('table.id'), nullable=False)
    """
    return Column(GUID(), *args, **kwargs)


# ─── ARRAY 列 ─────────────────────────────────────────

class StringArray(TypeDecorator):
    """跨数据库字符串数组：PG 原生 ARRAY，SQLite 用 JSON"""
    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_ARRAY(String))
        return dialect.type_descriptor(String)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        import json
        return json.dumps(value, ensure_ascii=False)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        import json
        if isinstance(value, str):
            return json.loads(value)
        return value


def ArrayColumn(*args, **kwargs):
    """返回跨数据库数组列"""
    return Column(StringArray(), *args, **kwargs)


# ─── Geo 辅助（SQLite 下跳过 Geography 字段） ────────

def supports_geography() -> bool:
    """当前数据库是否支持 PostGIS Geography 类型"""
    return is_postgres()


def GeoPointColumn(**kwargs):
    """
    PostGIS Geography 字段
    SQLite 下不作为独立列（使用 wgs84_lon/lat 替代）
    """
    if is_postgres():
        from geoalchemy2 import Geography
        kwargs.setdefault("nullable", True)
        return Column(Geography(geometry_type="POINT", srid=4326), **kwargs)
    # SQLite — 返回空列，使用 Float lon/lat
    return Column(Float, **kwargs)
