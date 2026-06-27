"""初始数据库 schema — 8 张核心表

Revision ID: 0001
Revises:
Create Date: 2026-06-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    is_pg = conn.dialect.name == "postgresql"

    # ---- place_names ----
    op.create_table(
        "place_names",
        sa.Column("place_id", sa.String(36), primary_key=True),
        sa.Column("ancient_name", sa.String(100), nullable=False, index=True),
        sa.Column("modern_name", sa.String(100), nullable=False, index=True),
        sa.Column("wgs84_lon", sa.Float(precision=6), nullable=False),
        sa.Column("wgs84_lat", sa.Float(precision=6), nullable=False),
        sa.Column("province", sa.String(50)),
        sa.Column("city", sa.String(50)),
        sa.Column("district", sa.String(50)),
        sa.Column("admin_level", sa.SmallInteger),
        sa.Column("source", sa.String(100)),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )

    # ---- place_name_changes ----
    op.create_table(
        "place_name_changes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("place_id", sa.String(36), sa.ForeignKey("place_names.place_id"), nullable=False),
        sa.Column("change_year", sa.String(10)),
        sa.Column("old_name", sa.String(100)),
        sa.Column("new_name", sa.String(100)),
        sa.Column("source", sa.String(100)),
    )

    # ---- place_ambiguity_rules ----
    op.create_table(
        "place_ambiguity_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("ambiguous_name", sa.String(100), nullable=False),
        sa.Column("target_place_id", sa.String(36), sa.ForeignKey("place_names.place_id"), nullable=False),
        sa.Column("dynasty_filter", sa.String(50)),
        sa.Column("context_keywords", sa.Text),
        sa.Column("priority", sa.SmallInteger, default=0),
    )

    # ---- poets ----
    op.create_table(
        "poets",
        sa.Column("poet_id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, index=True),
        sa.Column("birth_year", sa.String(20)),
        sa.Column("death_year", sa.String(20)),
        sa.Column("dynasty", sa.String(30), nullable=False, index=True),
        sa.Column("tags", sa.Text),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime),
    )

    # ---- poet_trajectories ----
    op.create_table(
        "poet_trajectories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("poet_id", sa.String(36), sa.ForeignKey("poets.poet_id"), nullable=False),
        sa.Column("event_year", sa.String(20), nullable=False),
        sa.Column("event_date_precision", sa.String(10), default="年"),
        sa.Column("ancient_place", sa.String(100)),
        sa.Column("place_id", sa.String(36), sa.ForeignKey("place_names.place_id")),
        sa.Column("wgs84_lon", sa.Float(precision=6)),
        sa.Column("wgs84_lat", sa.Float(precision=6)),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("stay_duration_days", sa.Integer),
        sa.Column("source", sa.String(100)),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_index("idx_trajectory_poet_year", "poet_trajectories", ["poet_id", "event_year"])
    op.create_index("idx_trajectory_type", "poet_trajectories", ["event_type"])

    # ---- poet_encounters ----
    op.create_table(
        "poet_encounters",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("poet_a_id", sa.String(36), sa.ForeignKey("poets.poet_id"), nullable=False),
        sa.Column("poet_b_id", sa.String(36), sa.ForeignKey("poets.poet_id"), nullable=False),
        sa.Column("overlap_start_year", sa.String(20)),
        sa.Column("overlap_end_year", sa.String(20)),
        sa.Column("overlap_lon", sa.Float(precision=6)),
        sa.Column("overlap_lat", sa.Float(precision=6)),
        sa.Column("encounter_probability", sa.Numeric(5, 4)),
        sa.Column("period_overlap_days", sa.Integer),
        sa.Column("area_overlap_km2", sa.Numeric(10, 2)),
        sa.Column("related_poetry_ids", sa.Text),
        sa.Column("created_at", sa.DateTime),
    )

    # ---- poetry ----
    op.create_table(
        "poetry",
        sa.Column("poetry_id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("poets.poet_id"), nullable=False),
        sa.Column("dynasty", sa.String(30), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("genre", sa.String(30)),
        sa.Column("rhythm_pattern", sa.String(100)),
        sa.Column("rhyme_category", sa.String(30)),
        sa.Column("created_at", sa.DateTime),
    )

    # ---- poetry_features ----
    op.create_table(
        "poetry_features",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("poetry_id", sa.String(36), sa.ForeignKey("poetry.poetry_id"), nullable=False, unique=True),
        sa.Column("geo_creation_place_id", sa.String(36), sa.ForeignKey("place_names.place_id")),
        sa.Column("geo_description_place_ids", sa.Text),
        sa.Column("creation_year", sa.String(20)),
        sa.Column("season", sa.Text),
        sa.Column("solar_term", sa.Text),
        sa.Column("festival", sa.Text),
        sa.Column("character_names", sa.Text),
        sa.Column("imagery_items", sa.Text),
        sa.Column("mood_tags", sa.Text),
        sa.Column("allusion_names", sa.Text),
        sa.Column("allusion_sources", sa.Text),
        sa.Column("allusion_targets", sa.Text),
    )

    # ---- PostgreSQL 专属：地理空间字段 + PostGIS 扩展 ----
    if is_pg:
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis_topology")
        op.execute("CREATE EXTENSION IF NOT EXISTS fuzzystrmatch")
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

        op.execute(
            "ALTER TABLE place_names ADD COLUMN geog geography(POINT, 4326)"
        )
        op.execute(
            "ALTER TABLE poet_trajectories ADD COLUMN geog geography(POINT, 4326)"
        )
        op.create_index("idx_place_names_geog", "place_names", ["geog"], postgresql_using="gist")
        op.create_index("idx_trajectory_geog", "poet_trajectories", ["geog"], postgresql_using="gist")


def downgrade() -> None:
    op.drop_table("poetry_features")
    op.drop_table("poetry")
    op.drop_table("poet_encounters")
    op.drop_table("poet_trajectories")
    op.drop_table("poets")
    op.drop_table("place_ambiguity_rules")
    op.drop_table("place_name_changes")

    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS idx_place_names_geog")
        op.execute("DROP INDEX IF EXISTS idx_trajectory_geog")

    op.drop_table("place_names")
