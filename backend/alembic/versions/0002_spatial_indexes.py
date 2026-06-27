"""PostGIS 空间索引 + 六维特征 GIN 索引

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-27
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    is_pg = conn.dialect.name == "postgresql"

    if is_pg:
        # PostGIS 空间索引（如果尚未创建）
        op.execute("""
            CREATE INDEX IF NOT EXISTS idx_place_names_geog
            ON place_names USING GIST (geog)
        """)
        op.execute("""
            CREATE INDEX IF NOT EXISTS idx_trajectory_geog
            ON poet_trajectories USING GIST (geog)
        """)
        # 六维特征 GIN 索引（提升数组列查询性能）
        op.execute("""
            CREATE INDEX IF NOT EXISTS idx_features_mood_tags
            ON poetry_features USING GIN (mood_tags)
        """)
        op.execute("""
            CREATE INDEX IF NOT EXISTS idx_features_imagery
            ON poetry_features USING GIN (imagery_items)
        """)
        op.execute("""
            CREATE INDEX IF NOT EXISTS idx_features_season
            ON poetry_features USING GIN (season)
        """)
    else:
        # SQLite：全文索引（LIKE 查询加速）
        op.create_index("idx_places_name_like", "place_names", ["ancient_name", "modern_name"])
        op.create_index("idx_poetry_title", "poetry", ["title"])


def downgrade() -> None:
    conn = op.get_bind()
    is_pg = conn.dialect.name == "postgresql"

    if is_pg:
        op.execute("DROP INDEX IF EXISTS idx_place_names_geog")
        op.execute("DROP INDEX IF EXISTS idx_trajectory_geog")
        op.execute("DROP INDEX IF EXISTS idx_features_mood_tags")
        op.execute("DROP INDEX IF EXISTS idx_features_imagery")
        op.execute("DROP INDEX IF EXISTS idx_features_season")
    else:
        op.drop_index("idx_places_name_like")
        op.drop_index("idx_poetry_title")
