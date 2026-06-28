"""
数据迁移脚本：SQLite → PostGIS
用法: python scripts/migrate_to_postgis.py
"""
import sys, os, json, asyncio, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# SQLite connection (source)
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///" + os.path.join(
    os.path.dirname(__file__), '..', 'backend', 'poetry_space_dev.db')

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Source: SQLite
sqlite_engine = create_async_engine(os.environ["DATABASE_URL"], echo=False)
SQLiteSession = async_sessionmaker(sqlite_engine, class_=AsyncSession)

# Target: PostGIS via SSH tunnel (port 15432)
pg_url = "postgresql+asyncpg://poetry:PoetrySpace2024!@localhost:15432/poetry_space"
pg_engine = create_async_engine(pg_url, echo=False)
PGSession = async_sessionmaker(pg_engine, class_=AsyncSession)

BATCH = 500

async def copy_table(model_class, table_name, columns, transform=None):
    """Copy data from SQLite to PostGIS"""
    from sqlalchemy import text as sqltext

    # Read from SQLite
    async with SQLiteSession() as src:
        rows = (await src.execute(sqltext(f"SELECT * FROM {table_name}"))).mappings().all()
    print(f"  {table_name}: {len(rows)} rows from SQLite", flush=True)

    # Write to PostGIS
    async with PGSession() as dst:
        # Clear existing
        await dst.execute(sqltext(f"TRUNCATE {table_name} CASCADE"))
        await dst.commit()

        added = 0
        for row in rows:
            row_dict = dict(row)
            if transform:
                row_dict = transform(row_dict)

            # Build INSERT
            cols = ', '.join(f'"{c}"' for c in row_dict.keys())
            vals = ', '.join(f':{c}' for c in row_dict.keys())
            try:
                await dst.execute(sqltext(f"INSERT INTO {table_name} ({cols}) VALUES ({vals})"), row_dict)
                added += 1
            except Exception as e:
                print(f"    Error: {e}", flush=True)

            if added % BATCH == 0:
                await dst.commit()
                print(f"    {added}/{len(rows)}...", flush=True)

        await dst.commit()
        print(f"  {table_name}: {added} copied", flush=True)

def transform_poet(row):
    """tags: JSON string → PostgreSQL array"""
    if row.get('tags') and isinstance(row['tags'], str):
        row['tags'] = json.loads(row['tags'])
    return row

def transform_poetry(row):
    return row

def transform_feature(row):
    """Array fields: JSON string → PostgreSQL array"""
    array_fields = ['season', 'solar_term', 'festival', 'character_names',
                    'imagery_items', 'mood_tags', 'allusion_names',
                    'allusion_sources', 'allusion_targets',
                    'geo_description_place_ids']
    for f in array_fields:
        if row.get(f) and isinstance(row[f], str):
            row[f] = json.loads(row[f])
    return row

def transform_trajectory(row):
    return row

def transform_encounter(row):
    if row.get('related_poetry_ids') and isinstance(row['related_poetry_ids'], str):
        row['related_poetry_ids'] = json.loads(row['related_poetry_ids'])
    return row

def transform_place(row):
    return row

def transform_change(row):
    return row

def transform_ambiguity(row):
    if row.get('context_keywords') and isinstance(row['context_keywords'], str):
        row['context_keywords'] = json.loads(row['context_keywords'])
    return row

async def main():
    tables = [
        ("place_names", transform_place),
        ("place_name_changes", transform_change),
        ("place_ambiguity_rules", transform_ambiguity),
        ("poets", transform_poet),
        ("poet_trajectories", transform_trajectory),
        ("poet_encounters", transform_encounter),
        ("poetry", transform_poetry),
        ("poetry_features", transform_feature),
    ]

    # First create tables on PostGIS
    print("Creating tables on PostGIS...", flush=True)
    from app.core.database import Base
    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.", flush=True)

    for table_name, transform_fn in tables:
        print(f"\nCopying {table_name}...", flush=True)
        t0 = time.time()
        await copy_table(None, table_name, transform_fn)
        print(f"  Done in {time.time()-t0:.0f}s", flush=True)

    # Verify
    print("\n=== Verification ===", flush=True)
    async with PGSession() as dst:
        for t, _ in tables:
            cnt = (await dst.execute(text(f"SELECT count(*) FROM {t}"))).scalar()
            print(f"  {t}: {cnt}", flush=True)

    await sqlite_engine.dispose()
    await pg_engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
