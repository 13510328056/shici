"""
批量导入脚本 — 全唐诗 / 全宋诗 / 宋词
从 chinese-poetry 仓库导入全部数据

用法: python scripts/import_bulk.py [tang|song|ci|all]
"""
import asyncio, json, os, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./poetry_space_dev.db"

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert

DB_URL = "sqlite+aiosqlite:///./poetry_space_dev.db"
engine = create_async_engine(DB_URL, echo=False, connect_args={"check_same_thread": False})
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

from app.core.compat import utcnow
from app.models.poet import Poet
from app.models.poetry import Poetry, PoetryFeature

SRC = Path(r"E:\PythonPrj\GSC\chinese-poetry")

# 作者缓存
_poet_cache: dict[str, Poet] = {}

async def ensure_poet(session: AsyncSession, name: str, dynasty: str) -> Poet:
    """获取或创建诗人"""
    key = f"{dynasty}:{name}"
    if key in _poet_cache:
        return _poet_cache[key]

    r = await session.execute(select(Poet).where(Poet.name == name, Poet.dynasty == dynasty))
    poet = r.scalar_one_or_none()
    if not poet:
        poet = Poet(name=name, dynasty=dynasty, created_at=utcnow())
        session.add(poet)
        await session.flush()
    _poet_cache[key] = poet
    return poet


async def import_filelist(filelist: list[tuple[str, str]], label: str, genre: str = "诗"):
    """批量导入文件列表

    filelist: [(文件路径, 朝代), ...]
    """
    total = 0
    skipped = 0
    start = time.time()
    BATCH = 500

    async with Session() as session:
        for fpath, dynasty in filelist:
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    poems_data = json.load(f)
            except Exception as e:
                print(f"  读取失败 {fpath}: {e}")
                continue

            for p in poems_data:
                author = (p.get("author") or "佚名").strip()
                title = (p.get("title") or "无题").strip()
                paragraphs = p.get("paragraphs") or []
                content = "".join(paragraphs) if paragraphs else ""

                if not content:
                    skipped += 1
                    continue

                # 查重
                poet = await ensure_poet(session, author, dynasty)
                r = await session.execute(
                    select(Poetry).where(Poetry.title == title, Poetry.author_id == poet.poet_id)
                )
                if r.scalar_one_or_none():
                    skipped += 1
                    continue

                poem = Poetry(
                    title=title, author_id=poet.poet_id, dynasty=dynasty,
                    content=content, genre=genre, created_at=utcnow(),
                )
                session.add(poem)
                total += 1

                # 批量 commit
                if total % BATCH == 0:
                    await session.commit()
                    elapsed = time.time() - start
                    print(f"  [{label}] 已导入 {total} 首 ({elapsed:.0f}s, {total/elapsed:.0f}首/s)...")

            # 每文件结束后清理缓存
            _poet_cache.clear()

        await session.commit()
        elapsed = time.time() - start
        print(f"  [{label}] OK: 新增 {total}, 跳过 {skipped}, 耗时 {elapsed:.0f}s ({total/elapsed:.0f}首/s)")


def find_tang_files() -> list[tuple[str, str]]:
    """查找全唐诗文件"""
    dir_path = SRC / "全唐诗"
    files = sorted(dir_path.glob("poet.tang.*.json"))
    return [(str(f), "唐") for f in files]


def find_song_files() -> list[tuple[str, str]]:
    """查找全宋诗文件"""
    dir_path = SRC / "全唐诗"
    files = sorted(dir_path.glob("poet.song.*.json"))
    return [(str(f), "宋") for f in files]


def find_ci_files() -> list[tuple[str, str]]:
    """查找宋词文件"""
    dir_path = SRC / "宋词"
    files = sorted(dir_path.glob("ci.song.*.json"))
    return [(str(f), "宋") for f in files]


async def main():
    args = sys.argv[1:] if len(sys.argv) > 1 else ["all"]
    mode = args[0]

    tasks = []
    if mode in ("all", "tang"):
        files = find_tang_files()
        print(f"\n全唐诗: {len(files)} 文件")
        tasks.append(import_filelist(files, "全唐诗"))

    if mode in ("all", "song"):
        files = find_song_files()
        print(f"\n全宋诗: {len(files)} 文件")
        tasks.append(import_filelist(files, "全宋诗"))

    if mode in ("all", "ci"):
        files = find_ci_files()
        print(f"\n宋词: {len(files)} 文件")
        tasks.append(import_filelist(files, "宋词", genre="词"))

    for t in tasks:
        await t

    # 最终统计
    async with Session() as session:
        for model, name in [(Poet, "诗人"), (Poetry, "诗词"), (PoetryFeature, "特征")]:
            cnt = (await session.execute(select(func.count()).select_from(model))).scalar()
            print(f"  {name}: {cnt}")


if __name__ == "__main__":
    asyncio.run(main())
